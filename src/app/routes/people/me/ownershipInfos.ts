/**
 * 自分の所有権ルーター
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';
import * as moment from 'moment';
import * as mongoose from 'mongoose';

import permitScopes from '../../../middlewares/permitScopes';
import validator from '../../../middlewares/validator';

import * as redis from '../../../../redis';

import accountsRouter from './ownershipInfos/accounts';
import creditCardsRouter from './ownershipInfos/creditCards';
import reservationsRouter from './ownershipInfos/reservations';

const CODE_EXPIRES_IN_SECONDS = Number(process.env.CODE_EXPIRES_IN_SECONDS);
const chevreAuthClient = new cinerino.chevre.auth.ClientCredentials({
    domain: <string>process.env.CHEVRE_AUTHORIZE_SERVER_DOMAIN,
    clientId: <string>process.env.CHEVRE_CLIENT_ID,
    clientSecret: <string>process.env.CHEVRE_CLIENT_SECRET,
    scopes: [],
    state: ''
});
const pecorinoAuthClient = new cinerino.pecorinoapi.auth.ClientCredentials({
    domain: <string>process.env.PECORINO_AUTHORIZE_SERVER_DOMAIN,
    clientId: <string>process.env.PECORINO_CLIENT_ID,
    clientSecret: <string>process.env.PECORINO_CLIENT_SECRET,
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
    permitScopes(['aws.cognito.signin.user.admin']),
    (_1, _2, next) => {
        next();
    },
    validator,
    async (req, res, next) => {
        try {
            const query = <cinerino.factory.ownershipInfo.ISearchConditions<cinerino.factory.ownershipInfo.IGoodType>>req.query;
            const typeOfGood = query.typeOfGood;
            let ownershipInfos:
                cinerino.factory.ownershipInfo.IOwnershipInfo<cinerino.factory.ownershipInfo.IGoodWithDetail<typeof typeOfGood.typeOf>>[];
            const searchConditions: cinerino.factory.ownershipInfo.ISearchConditions<typeof typeOfGood.typeOf> = {
                // tslint:disable-next-line:no-magic-numbers
                limit: (query.limit !== undefined) ? Math.min(query.limit, 100) : 100,
                page: (query.page !== undefined) ? Math.max(query.page, 1) : 1,
                sort: query.sort,
                ownedBy: { id: req.user.sub },
                ownedFrom: (query.ownedFrom !== undefined) ? moment(query.ownedFrom)
                    .toDate() : undefined,
                ownedThrough: (query.ownedThrough !== undefined) ? moment(query.ownedThrough)
                    .toDate() : undefined,
                typeOfGood: typeOfGood
            };
            const ownershipInfoRepo = new cinerino.repository.OwnershipInfo(mongoose.connection);
            const totalCount = await ownershipInfoRepo.count(searchConditions);
            switch (typeOfGood.typeOf) {
                case cinerino.factory.ownershipInfo.AccountGoodType.Account:
                    const accountService = new cinerino.pecorinoapi.service.Account({
                        endpoint: <string>process.env.PECORINO_ENDPOINT,
                        auth: pecorinoAuthClient
                    });
                    ownershipInfos = await cinerino.service.account.search({ ...searchConditions, typeOfGood: typeOfGood })({
                        ownershipInfo: ownershipInfoRepo,
                        accountService: accountService
                    });
                    break;
                case cinerino.factory.chevre.reservationType.EventReservation:
                    const reservationService = new cinerino.chevre.service.Reservation({
                        endpoint: <string>process.env.CHEVRE_ENDPOINT,
                        auth: chevreAuthClient
                    });
                    ownershipInfos = await cinerino.service.reservation.searchScreeningEventReservations(
                        { ...searchConditions, typeOfGood: typeOfGood }
                    )({
                        ownershipInfo: ownershipInfoRepo,
                        reservationService: reservationService
                    });
                    break;

                default:
                    throw new cinerino.factory.errors.Argument('typeOfGood.typeOf', 'Unknown good type');
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
    permitScopes(['aws.cognito.signin.user.admin']),
    (_1, _2, next) => {
        next();
    },
    validator,
    async (req, res, next) => {
        try {
            const codeRepo = new cinerino.repository.Code(redis.getClient());
            const ownershipInfoRepo = new cinerino.repository.OwnershipInfo(mongoose.connection);
            const ownershipInfo = await ownershipInfoRepo.findById({ id: req.params.id });
            if (ownershipInfo.ownedBy.id !== req.user.sub) {
                throw new cinerino.factory.errors.Unauthorized();
            }
            const code = await codeRepo.publish({
                data: ownershipInfo,
                expiresInSeconds: CODE_EXPIRES_IN_SECONDS
            });

            // 座席予約に対する所有権であれば、Chevreでチェックイン
            if (ownershipInfo.typeOfGood.typeOf === cinerino.factory.chevre.reservationType.EventReservation) {
                const reservationService = new cinerino.chevre.service.Reservation({
                    endpoint: <string>process.env.CHEVRE_ENDPOINT,
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
