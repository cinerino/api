/**
 * 予約ルーター
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';
// tslint:disable-next-line:no-submodule-imports
import { body } from 'express-validator/check';
import * as mongoose from 'mongoose';

import authentication from '../middlewares/authentication';
import permitScopes from '../middlewares/permitScopes';
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

reservationsRouter.use(authentication);

/**
 * 管理者として予約検索
 */
reservationsRouter.get(
    '',
    permitScopes([]),
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
            res.set('X-Total-Count', searchResult.totalCount.toString());
            res.json(searchResult.data);
        } catch (error) {
            next(error);
        }
    }
);

/**
 * 管理者として予約検索
 * @deprecated Use /reservations
 */
reservationsRouter.get(
    '/eventReservation/screeningEvent',
    permitScopes([]),
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
            res.set('X-Total-Count', searchResult.totalCount.toString());
            res.json(searchResult.data);
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
    permitScopes(['tokens', 'tokens.read-only']),
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
                    issuer: <string>process.env.RESOURCE_SERVER_IDENTIFIER
                })({ action: new cinerino.repository.Action(mongoose.connection) });
            const ownershipInfoRepo = new cinerino.repository.OwnershipInfo(mongoose.connection);
            const ownershipInfo = await ownershipInfoRepo.search<cinerino.factory.chevre.reservationType.EventReservation>({
                typeOfGood: {
                    typeOf: cinerino.factory.chevre.reservationType.EventReservation,
                    id: payload.typeOfGood.id
                }
            })
                .then((infos) => {
                    if (infos.length === 0) {
                        throw new cinerino.factory.errors.NotFound('OwnershipInfo');
                    }

                    return infos[0];
                });

            const reservationService = new cinerino.chevre.service.Reservation({
                endpoint: project.settings.chevre.endpoint,
                auth: chevreAuthClient
            });
            const reservation = await reservationService.findById<cinerino.factory.chevre.reservationType.EventReservation>({
                id: <string>ownershipInfo.typeOfGood.id
            });

            // 入場
            await reservationService.attendScreeningEvent(reservation);

            res.json({ ...ownershipInfo, typeOfGood: reservation });
        } catch (error) {
            next(error);
        }
    }
);

export default reservationsRouter;
