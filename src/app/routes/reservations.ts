/**
 * 予約ルーター
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';
import { body, query } from 'express-validator';
import { NO_CONTENT } from 'http-status';
import * as mongoose from 'mongoose';

import permitScopes from '../middlewares/permitScopes';
import rateLimit from '../middlewares/rateLimit';
import validator from '../middlewares/validator';

type IPayload =
    cinerino.factory.ownershipInfo.IOwnershipInfo<cinerino.factory.ownershipInfo.IGood<cinerino.factory.chevre.reservationType>>;

const chevreAuthClient = new cinerino.chevre.auth.ClientCredentials({
    domain: <string>process.env.CHEVRE_AUTHORIZE_SERVER_DOMAIN,
    clientId: <string>process.env.CHEVRE_CLIENT_ID,
    clientSecret: <string>process.env.CHEVRE_CLIENT_SECRET,
    scopes: [],
    state: ''
});

const reservationsRouter = Router();

/**
 * 管理者として予約検索
 */
reservationsRouter.get(
    '',
    permitScopes(['reservations.*', 'reservations.read']),
    rateLimit,
    ...[
        query('bookingFrom')
            .optional()
            .isISO8601()
            .toDate(),
        query('bookingThrough')
            .optional()
            .isISO8601()
            .toDate(),
        query('modifiedFrom')
            .optional()
            .isISO8601()
            .toDate(),
        query('modifiedThrough')
            .optional()
            .isISO8601()
            .toDate()
    ],
    validator,
    async (req, res, next) => {
        try {
            const projectRepo = new cinerino.repository.Project(mongoose.connection);
            const project = await projectRepo.findById({ id: req.project.id });
            if (project.settings === undefined) {
                throw new cinerino.factory.errors.ServiceUnavailable('Project settings undefined');
            }
            if (project.settings.chevre === undefined) {
                throw new cinerino.factory.errors.ServiceUnavailable('Project settings not found');
            }

            // クエリをそのままChevre検索へパス
            const reservationService = new cinerino.chevre.service.Reservation({
                endpoint: project.settings.chevre.endpoint,
                auth: chevreAuthClient
            });
            const searchResult = await reservationService.search({
                ...req.query,
                project: { ids: [req.project.id] },
                typeOf: cinerino.factory.chevre.reservationType.EventReservation
            });
            // res.set('X-Total-Count', searchResult.totalCount.toString());
            res.json(searchResult.data);
        } catch (error) {
            next(error);
        }
    }
);

/**
 * ストリーミングダウンロード
 */
reservationsRouter.get(
    '/download',
    permitScopes([]),
    rateLimit,
    validator,
    async (req, res, next) => {
        try {
            const projectRepo = new cinerino.repository.Project(mongoose.connection);
            const project = await projectRepo.findById({ id: req.project.id });
            if (project.settings === undefined) {
                throw new cinerino.factory.errors.ServiceUnavailable('Project settings undefined');
            }
            if (project.settings.chevre === undefined) {
                throw new cinerino.factory.errors.ServiceUnavailable('Project settings not found');
            }

            // クエリをそのままChevre検索へパス
            const reservationService = new cinerino.chevre.service.Reservation({
                endpoint: <string>process.env.CHEVRE_STREAMING_API_ENDPOINT,
                auth: chevreAuthClient
            });
            const stream = <NodeJS.ReadableStream>await reservationService.download({
                ...req.query,
                project: { ids: [req.project.id] }
            });

            res.type(`${req.query.format}; charset=utf-8`);
            stream.pipe(res);
        } catch (error) {
            next(error);
        }
    }
);

/**
 * トークンで予約照会
 */
reservationsRouter.post(
    '/eventReservation/screeningEvent/findByToken',
    permitScopes(['reservations.read', 'reservations.findByToken']),
    rateLimit,
    ...[
        body('token')
            .not()
            .isEmpty()
            .withMessage((_, __) => 'required')
    ],
    validator,
    async (req, res, next) => {
        try {
            const projectRepo = new cinerino.repository.Project(mongoose.connection);
            const project = await projectRepo.findById({ id: req.project.id });
            if (project.settings === undefined) {
                throw new cinerino.factory.errors.ServiceUnavailable('Project settings undefined');
            }
            if (project.settings.chevre === undefined) {
                throw new cinerino.factory.errors.ServiceUnavailable('Project settings not found');
            }

            const payload =
                await cinerino.service.code.verifyToken<IPayload>({
                    project: req.project,
                    agent: req.agent,
                    token: req.body.token,
                    secret: <string>process.env.TOKEN_SECRET,
                    issuer: [<string>process.env.RESOURCE_SERVER_IDENTIFIER]
                })({ action: new cinerino.repository.Action(mongoose.connection) });

            const ownershipInfoRepo = new cinerino.repository.OwnershipInfo(mongoose.connection);

            // 所有権検索
            const ownershipInfo = await ownershipInfoRepo.findById({
                id: payload.id
            });
            const typeOfGood = ownershipInfo.typeOfGood;
            if (typeOfGood.typeOf !== cinerino.factory.chevre.reservationType.EventReservation) {
                throw new cinerino.factory.errors.Argument('token', 'Not reservation');
            }

            // 予約検索
            const reservationService = new cinerino.chevre.service.Reservation({
                endpoint: project.settings.chevre.endpoint,
                auth: chevreAuthClient
            });
            const reservation = await reservationService.findById<cinerino.factory.chevre.reservationType.EventReservation>({
                id: <string>typeOfGood.id
            });

            // 入場
            await reservationService.attendScreeningEvent(reservation);

            res.json({ ...ownershipInfo, typeOfGood: reservation });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * 発券
 */
reservationsRouter.put(
    '/checkedIn',
    permitScopes(['reservations.findByToken']),
    validator,
    async (req, res, next) => {
        try {
            const projectRepo = new cinerino.repository.Project(mongoose.connection);
            const project = await projectRepo.findById({ id: req.project.id });
            if (typeof project.settings?.chevre?.endpoint !== 'string') {
                throw new cinerino.factory.errors.ServiceUnavailable('Project settings not satisfied');
            }

            const reservationService = new cinerino.chevre.service.Reservation({
                endpoint: project.settings.chevre.endpoint,
                auth: chevreAuthClient
            });
            await reservationService.checkInScreeningEventReservations(req.body);

            res.status(NO_CONTENT)
                .end();
        } catch (error) {
            next(error);
        }
    }
);

/**
 * 入場
 */
reservationsRouter.put(
    '/:id/attended',
    permitScopes(['reservations.findByToken']),
    validator,
    async (req, res, next) => {
        try {
            const projectRepo = new cinerino.repository.Project(mongoose.connection);
            const project = await projectRepo.findById({ id: req.project.id });
            if (typeof project.settings?.chevre?.endpoint !== 'string') {
                throw new cinerino.factory.errors.ServiceUnavailable('Project settings not satisfied');
            }

            const reservationService = new cinerino.chevre.service.Reservation({
                endpoint: project.settings.chevre.endpoint,
                auth: chevreAuthClient
            });
            await reservationService.attendScreeningEvent({ id: req.params.id });

            res.status(NO_CONTENT)
                .end();
        } catch (error) {
            next(error);
        }
    }
);

export default reservationsRouter;
