/**
 * 注文返品取引ルーター
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';
import { NO_CONTENT } from 'http-status';
import * as moment from 'moment';

import authentication from '../../middlewares/authentication';
import permitScopes from '../../middlewares/permitScopes';
import validator from '../../middlewares/validator';

const returnOrderTransactionsRouter = Router();
const actionRepo = new cinerino.repository.Action(cinerino.mongoose.connection);
const orderRepo = new cinerino.repository.Order(cinerino.mongoose.connection);
const organizationRepo = new cinerino.repository.Organization(cinerino.mongoose.connection);
const chevreAuthClient = new cinerino.chevre.auth.ClientCredentials({
    domain: <string>process.env.CHEVRE_AUTHORIZE_SERVER_DOMAIN,
    clientId: <string>process.env.CHEVRE_CLIENT_ID,
    clientSecret: <string>process.env.CHEVRE_CLIENT_SECRET,
    scopes: [],
    state: ''
});
returnOrderTransactionsRouter.use(authentication);
returnOrderTransactionsRouter.post(
    '/start',
    permitScopes(['admin']),
    (req, _, next) => {
        req.checkBody('expires', 'invalid expires').notEmpty().withMessage('expires is required').isISO8601();
        req.checkBody('transactionId', 'invalid transactionId').notEmpty().withMessage('transactionId is required');
        next();
    },
    validator,
    async (req, res, next) => {
        try {
            const transactionRepo = new cinerino.repository.Transaction(cinerino.mongoose.connection);
            const cancelReservationService = new cinerino.chevre.service.transaction.CancelReservation({
                endpoint: <string>process.env.CHEVRE_ENDPOINT,
                auth: chevreAuthClient
            });
            const transaction = await cinerino.service.transaction.returnOrder.start({
                expires: moment(req.body.expires).toDate(),
                agentId: req.user.sub,
                transactionId: req.body.transactionId,
                clientUser: req.user,
                cancellationFee: 0,
                forcibly: true,
                reason: cinerino.factory.transaction.returnOrder.Reason.Seller
            })({
                action: actionRepo,
                transaction: transactionRepo,
                order: orderRepo,
                cancelReservationService: cancelReservationService
            });
            // tslint:disable-next-line:no-string-literal
            // const host = req.headers['host'];
            // res.setHeader('Location', `https://${host}/transactions/${transaction.id}`);
            res.json(transaction);
        } catch (error) {
            next(error);
        }
    }
);
returnOrderTransactionsRouter.put(
    '/:transactionId/confirm',
    permitScopes(['admin']),
    validator,
    async (req, res, next) => {
        try {
            const transactionRepo = new cinerino.repository.Transaction(cinerino.mongoose.connection);
            await cinerino.service.transaction.returnOrder.confirm(
                req.user.sub,
                req.params.transactionId
            )({
                action: actionRepo,
                transaction: transactionRepo,
                organization: organizationRepo
            });
            res.status(NO_CONTENT).end();
        } catch (error) {
            next(error);
        }
    }
);
/**
 * 取引検索
 */
returnOrderTransactionsRouter.get(
    '',
    permitScopes(['admin']),
    validator,
    async (req, res, next) => {
        try {
            const transactionRepo = new cinerino.repository.Transaction(cinerino.mongoose.connection);
            const searchConditions: cinerino.factory.transaction.ISearchConditions<cinerino.factory.transactionType.ReturnOrder> = {
                // tslint:disable-next-line:no-magic-numbers
                limit: (req.query.limit !== undefined) ? Math.min(req.query.limit, 100) : 100,
                page: (req.query.page !== undefined) ? Math.max(req.query.page, 1) : 1,
                sort: (req.query.sort !== undefined) ? req.query.sort : { orderDate: cinerino.factory.sortType.Descending },
                typeOf: cinerino.factory.transactionType.ReturnOrder,
                ids: (Array.isArray(req.query.ids)) ? req.query.ids : undefined,
                statuses: (Array.isArray(req.query.statuses)) ? req.query.statuses : undefined,
                startFrom: (req.query.startFrom !== undefined) ? moment(req.query.startFrom).toDate() : undefined,
                startThrough: (req.query.startThrough !== undefined) ? moment(req.query.startThrough).toDate() : undefined,
                endFrom: (req.query.endFrom !== undefined) ? moment(req.query.endFrom).toDate() : undefined,
                endThrough: (req.query.endThrough !== undefined) ? moment(req.query.endThrough).toDate() : undefined,
                agent: req.query.agent
            };
            const transactions = await transactionRepo.search(searchConditions);
            const totalCount = await transactionRepo.count(searchConditions);
            res.set('X-Total-Count', totalCount.toString());
            res.json(transactions);
        } catch (error) {
            next(error);
        }
    }
);
export default returnOrderTransactionsRouter;
