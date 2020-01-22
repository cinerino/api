/**
 * 自分の所有権ルーター
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';
import { query } from 'express-validator';
import * as mongoose from 'mongoose';

import permitScopes from '../../../middlewares/permitScopes';
import rateLimit from '../../../middlewares/rateLimit';
import validator from '../../../middlewares/validator';

import accountsRouter from './ownershipInfos/accounts';
import creditCardsRouter from './ownershipInfos/creditCards';
import reservationsRouter from './ownershipInfos/reservations';

const chevreAuthClient = new cinerino.chevre.auth.ClientCredentials({
    domain: <string>process.env.CHEVRE_AUTHORIZE_SERVER_DOMAIN,
    clientId: <string>process.env.CHEVRE_CLIENT_ID,
    clientSecret: <string>process.env.CHEVRE_CLIENT_SECRET,
    scopes: [],
    state: ''
});

const ownershipInfosRouter = Router();

ownershipInfosRouter.use('/accounts', accountsRouter);
ownershipInfosRouter.use('/creditCards', creditCardsRouter);
ownershipInfosRouter.use('/reservations', reservationsRouter);

/**
 * 所有権検索
 */
ownershipInfosRouter.get(
    '',
    permitScopes(['people.me.*']),
    rateLimit,
    ...[
        query('typeOfGood')
            .not()
            .isEmpty(),
        query('ownedFrom')
            .optional()
            .isISO8601()
            .toDate(),
        query('ownedThrough')
            .optional()
            .isISO8601()
            .toDate()
    ],
    validator,
    async (req, res, next) => {
        try {
            let ownershipInfos:
                cinerino.factory.ownershipInfo.IOwnershipInfo<cinerino.factory.ownershipInfo.IGoodWithDetail<typeof typeOfGood.typeOf>>[];
            const searchConditions: cinerino.factory.ownershipInfo.ISearchConditions<typeof typeOfGood.typeOf> = {
                ...req.query,
                project: { id: { $eq: req.project.id } },
                // tslint:disable-next-line:no-magic-numbers
                limit: (req.query.limit !== undefined) ? Math.min(req.query.limit, 100) : 100,
                page: (req.query.page !== undefined) ? Math.max(req.query.page, 1) : 1,
                ownedBy: { id: req.user.sub }
            };
            const ownershipInfoRepo = new cinerino.repository.OwnershipInfo(mongoose.connection);
            const projectRepo = new cinerino.repository.Project(mongoose.connection);

            const totalCount = await ownershipInfoRepo.count(searchConditions);

            const typeOfGood = <cinerino.factory.ownershipInfo.ITypeOfGoodSearchConditions<any>>req.query.typeOfGood;
            switch (typeOfGood.typeOf) {
                case cinerino.factory.ownershipInfo.AccountGoodType.Account:
                    ownershipInfos = await cinerino.service.account.search({
                        project: req.project,
                        conditions: searchConditions
                    })({
                        ownershipInfo: ownershipInfoRepo,
                        project: projectRepo
                    });

                    break;

                case cinerino.factory.chevre.reservationType.EventReservation:
                    ownershipInfos = await cinerino.service.reservation.searchScreeningEventReservations(<any>{
                        ...searchConditions,
                        project: { typeOf: req.project.typeOf, id: req.project.id }
                    })({
                        ownershipInfo: ownershipInfoRepo,
                        project: projectRepo
                    });
                    break;

                default:
                    ownershipInfos = await ownershipInfoRepo.search(searchConditions);
                // throw new cinerino.factory.errors.Argument('typeOfGood.typeOf', 'Unknown good type');
            }

            res.set('X-Total-Count', totalCount.toString());
            res.json(ownershipInfos);
        } catch (error) {
            next(error);
        }
    }
);

/**
 * 所有権に対して認可コードを発行する
 */
ownershipInfosRouter.post(
    '/:id/authorize',
    permitScopes(['people.me.*']),
    rateLimit,
    validator,
    async (req, res, next) => {
        try {
            const actionRepo = new cinerino.repository.Action(mongoose.connection);
            const projectRepo = new cinerino.repository.Project(mongoose.connection);
            const codeRepo = new cinerino.repository.Code(mongoose.connection);
            const ownershipInfoRepo = new cinerino.repository.OwnershipInfo(mongoose.connection);

            const project = await projectRepo.findById({ id: req.project.id });

            const ownershipInfo = await ownershipInfoRepo.findById({ id: req.params.id });
            if (ownershipInfo.ownedBy.id !== req.user.sub) {
                throw new cinerino.factory.errors.Unauthorized();
            }

            const authorization = await cinerino.service.code.publish({
                project: req.project,
                agent: req.agent,
                recipient: req.agent,
                object: ownershipInfo,
                purpose: {},
                validFrom: new Date()
            })({
                action: actionRepo,
                code: codeRepo,
                project: projectRepo
            });
            const code = authorization.code;

            // 座席予約に対する所有権であれば、Chevreでチェックイン
            if (ownershipInfo.typeOfGood.typeOf === cinerino.factory.chevre.reservationType.EventReservation) {
                if (project.settings === undefined) {
                    throw new cinerino.factory.errors.ServiceUnavailable('Project settings undefined');
                }
                if (project.settings.chevre === undefined) {
                    throw new cinerino.factory.errors.ServiceUnavailable('Project settings not found');
                }

                const reservationService = new cinerino.chevre.service.Reservation({
                    endpoint: project.settings.chevre.endpoint,
                    auth: chevreAuthClient
                });
                await reservationService.checkInScreeningEventReservations({ id: ownershipInfo.typeOfGood.id });
            }

            res.json({ code });
        } catch (error) {
            next(error);
        }
    }
);

export default ownershipInfosRouter;
