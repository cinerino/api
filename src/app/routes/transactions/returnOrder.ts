/**
 * 注文返品取引ルーター
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';
// tslint:disable-next-line:no-submodule-imports
import { body, query } from 'express-validator/check';
import { NO_CONTENT } from 'http-status';
import * as mongoose from 'mongoose';

import authentication from '../../middlewares/authentication';
import permitScopes from '../../middlewares/permitScopes';
import validator from '../../middlewares/validator';

const chevreAuthClient = new cinerino.chevre.auth.ClientCredentials({
    domain: <string>process.env.CHEVRE_AUTHORIZE_SERVER_DOMAIN,
    clientId: <string>process.env.CHEVRE_CLIENT_ID,
    clientSecret: <string>process.env.CHEVRE_CLIENT_SECRET,
    scopes: [],
    state: ''
});

const returnOrderTransactionsRouter = Router();
returnOrderTransactionsRouter.use(authentication);

returnOrderTransactionsRouter.post(
    '/start',
    permitScopes(['admin', 'transactions']),
    ...[
        body('expires')
            .not()
            .isEmpty()
            .withMessage((_, options) => `${options.path} is required`)
            .isISO8601()
            .toDate(),
        body('object.order.orderNumber')
            .not()
            .isEmpty()
            .withMessage((_, options) => `${options.path} is required`)
    ],
    validator,
    async (req, res, next) => {
        try {
            const actionRepo = new cinerino.repository.Action(mongoose.connection);
            const invoiceRepo = new cinerino.repository.Invoice(mongoose.connection);
            const orderRepo = new cinerino.repository.Order(mongoose.connection);
            const transactionRepo = new cinerino.repository.Transaction(mongoose.connection);
            const cancelReservationService = new cinerino.chevre.service.transaction.CancelReservation({
                endpoint: <string>process.env.CHEVRE_ENDPOINT,
                auth: chevreAuthClient
            });

            let order: cinerino.factory.order.IOrder | undefined;
            let returnableOrder: cinerino.factory.transaction.returnOrder.IReturnableOrder = req.body.object.order;

            // APIユーザーが管理者の場合、顧客情報を自動取得
            if (req.isAdmin) {
                order = await orderRepo.findByOrderNumber({ orderNumber: returnableOrder.orderNumber });
                returnableOrder = { ...returnableOrder, customer: { email: order.customer.email, telephone: order.customer.telephone } };
            } else {
                const returnableOrderCustomer = returnableOrder.customer;
                if (returnableOrderCustomer === undefined) {
                    throw new cinerino.factory.errors.ArgumentNull('Order Customer', 'Order customer info required');
                }
                if (returnableOrderCustomer.email === undefined && returnableOrderCustomer.telephone === undefined) {
                    throw new cinerino.factory.errors.ArgumentNull('Order Customer', 'Order customer info required');
                }

                const orders = await orderRepo.search({
                    orderNumbers: [returnableOrder.orderNumber],
                    customer: returnableOrder.customer
                });
                order = orders.shift();
                if (order === undefined) {
                    throw new cinerino.factory.errors.NotFound('Order');
                }
                returnableOrder = order;
            }

            const transaction = await cinerino.service.transaction.returnOrder.start({
                expires: req.body.expires,
                agent: {
                    ...req.agent,
                    identifier: [
                        ...(req.agent.identifier !== undefined) ? req.agent.identifier : [],
                        ...(req.body.agent !== undefined && req.body.agent.identifier !== undefined) ? req.body.agent.identifier : []
                    ]
                },
                object: {
                    order: returnableOrder,
                    clientUser: req.user,
                    cancellationFee: 0,
                    // forcibly: true,
                    reason: cinerino.factory.transaction.returnOrder.Reason.Seller
                }
            })({
                action: actionRepo,
                invoice: invoiceRepo,
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
    permitScopes(['admin', 'transactions']),
    validator,
    async (req, res, next) => {
        try {
            const actionRepo = new cinerino.repository.Action(mongoose.connection);
            const sellerRepo = new cinerino.repository.Seller(mongoose.connection);
            const transactionRepo = new cinerino.repository.Transaction(mongoose.connection);
            await cinerino.service.transaction.returnOrder.confirm({
                id: req.params.transactionId,
                agent: { id: req.user.sub }
            })({
                action: actionRepo,
                transaction: transactionRepo,
                seller: sellerRepo
            });
            res.status(NO_CONTENT)
                .end();
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
    ...[
        query('startFrom')
            .optional()
            .isISO8601()
            .toDate(),
        query('startThrough')
            .optional()
            .isISO8601()
            .toDate(),
        query('endFrom')
            .optional()
            .isISO8601()
            .toDate(),
        query('endThrough')
            .optional()
            .isISO8601()
            .toDate()
    ],
    validator,
    async (req, res, next) => {
        try {
            const transactionRepo = new cinerino.repository.Transaction(mongoose.connection);
            const searchConditions: cinerino.factory.transaction.ISearchConditions<cinerino.factory.transactionType.ReturnOrder> = {
                ...req.query,
                // tslint:disable-next-line:no-magic-numbers
                limit: (req.query.limit !== undefined) ? Math.min(req.query.limit, 100) : 100,
                page: (req.query.page !== undefined) ? Math.max(req.query.page, 1) : 1,
                typeOf: cinerino.factory.transactionType.ReturnOrder
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
