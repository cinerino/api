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

const CODE_EXPIRES_IN_SECONDS_DEFAULT = (typeof process.env.CODE_EXPIRES_IN_SECONDS_DEFAULT === 'string')
    ? Number(process.env.CODE_EXPIRES_IN_SECONDS_DEFAULT)
    // tslint:disable-next-line:no-magic-numbers
    : 600;

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
            const productService = new cinerino.chevre.service.Product({
                endpoint: cinerino.credentials.chevre.endpoint,
                auth: chevreAuthClient
            });
            const searchPaymentCardProductsResult = await productService.search({
                limit: 100,
                project: { id: { $eq: req.project.id } },
                typeOf: { $eq: cinerino.factory.chevre.product.ProductType.PaymentCard }
            });
            const paymentCardProducts = searchPaymentCardProductsResult.data;
            const paymentCardOutputTypes = [...new Set(paymentCardProducts.map((p) => String(p.serviceOutput?.typeOf)))];

            let ownershipInfos: cinerino.factory.ownershipInfo.IOwnershipInfo<cinerino.factory.ownershipInfo.IGoodWithDetail>[]
                | cinerino.factory.ownershipInfo.IOwnershipInfo<cinerino.factory.ownershipInfo.IGood>[];
            const searchConditions: cinerino.factory.ownershipInfo.ISearchConditions = {
                ...req.query,
                project: { id: { $eq: req.project.id } },
                // tslint:disable-next-line:no-magic-numbers
                limit: (req.query.limit !== undefined) ? Math.min(req.query.limit, 100) : 100,
                page: (req.query.page !== undefined) ? Math.max(req.query.page, 1) : 1,
                ownedBy: { id: req.user.sub }
            };
            const ownershipInfoRepo = new cinerino.repository.OwnershipInfo(mongoose.connection);
            const projectRepo = new cinerino.repository.Project(mongoose.connection);

            const typeOfGood = <cinerino.factory.ownershipInfo.ITypeOfGoodSearchConditions>req.query.typeOfGood;
            switch (true) {
                case paymentCardOutputTypes.includes(String(typeOfGood.typeOf)):
                    ownershipInfos = await cinerino.service.account.search({
                        project: req.project,
                        conditions: searchConditions
                    })({
                        ownershipInfo: ownershipInfoRepo,
                        project: projectRepo
                    });

                    break;

                case cinerino.factory.chevre.reservationType.EventReservation === typeOfGood.typeOf:
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
            const now = new Date();

            const actionRepo = new cinerino.repository.Action(mongoose.connection);
            const codeRepo = new cinerino.repository.Code(mongoose.connection);
            const ownershipInfoRepo = new cinerino.repository.OwnershipInfo(mongoose.connection);

            const ownershipInfo = await ownershipInfoRepo.findById({ id: req.params.id });
            if (ownershipInfo.ownedBy.id !== req.user.sub) {
                throw new cinerino.factory.errors.Unauthorized();
            }

            const expiresInSeconds = CODE_EXPIRES_IN_SECONDS_DEFAULT;

            const authorizations = await cinerino.service.code.publish({
                project: req.project,
                agent: req.agent,
                recipient: req.agent,
                object: [ownershipInfo],
                purpose: {},
                validFrom: now,
                expiresInSeconds: expiresInSeconds
            })({
                action: actionRepo,
                code: codeRepo
            });
            const code = authorizations[0].code;

            // 座席予約に対する所有権であれば、Chevreでチェックイン
            if (ownershipInfo.typeOfGood.typeOf === cinerino.factory.chevre.reservationType.EventReservation) {
                const reservationService = new cinerino.chevre.service.Reservation({
                    endpoint: cinerino.credentials.chevre.endpoint,
                    auth: chevreAuthClient
                });
                await reservationService.checkInScreeningEventReservations({
                    id: (<cinerino.factory.ownershipInfo.IReservation>ownershipInfo.typeOfGood).id
                });
            }

            res.json({ code });
        } catch (error) {
            next(error);
        }
    }
);

export default ownershipInfosRouter;
