/**
 * 注文返品取引ルーター
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';
// tslint:disable-next-line:no-implicit-dependencies
import { ParamsDictionary } from 'express-serve-static-core';
import { body, query } from 'express-validator';
import { NO_CONTENT } from 'http-status';
import * as mongoose from 'mongoose';

import lockTransaction from '../../middlewares/lockTransaction';
import permitScopes from '../../middlewares/permitScopes';
import rateLimit from '../../middlewares/rateLimit';
import rateLimit4transactionInProgress from '../../middlewares/rateLimit4transactionInProgress';
import validator from '../../middlewares/validator';

import * as redis from '../../../redis';

const ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH = (process.env.ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH !== undefined)
    ? Number(process.env.ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH)
    // tslint:disable-next-line:no-magic-numbers
    : 256;

const CANCELLATION_FEE = 1000;

const returnOrderTransactionsRouter = Router();

/**
 * 正規表現をエスケープする
 */
function escapeRegExp(params: string) {
    return params.replace(/[.*+?^=!:${}()|[\]\/\\]/g, '\\$&');
}

returnOrderTransactionsRouter.post(
    '/start',
    permitScopes(['transactions', 'pos']),
    rateLimit,
    (req, _, next) => {
        // 互換性維持対応として、注文指定を配列に変換
        if (req.body.object?.order !== undefined && req.body.object?.order !== null && !Array.isArray(req.body.object?.order)) {
            req.body.object.order = [req.body.object.order];
        }

        next();
    },
    ...[
        body('expires')
            .not()
            .isEmpty()
            .withMessage(() => 'expires required')
            .isISO8601()
            .toDate(),
        body('object.order.*.orderNumber')
            .not()
            .isEmpty()
            .withMessage(() => 'orderNumber required')
    ],
    validator,
    async (req, res, next) => {
        try {
            const actionRepo = new cinerino.repository.Action(mongoose.connection);
            const invoiceRepo = new cinerino.repository.Invoice(mongoose.connection);
            const orderRepo = new cinerino.repository.Order(mongoose.connection);
            const projectRepo = new cinerino.repository.Project(mongoose.connection);
            const transactionRepo = new cinerino.repository.Transaction(mongoose.connection);

            let order: cinerino.factory.order.IOrder | undefined;
            let returnableOrder: cinerino.factory.transaction.returnOrder.IReturnableOrder[] = req.body.object.order;

            // APIユーザーが管理者の場合、顧客情報を自動取得
            if (req.isAdmin) {
                order = await orderRepo.findByOrderNumber({ orderNumber: returnableOrder[0].orderNumber });
                // returnableOrder = { ...returnableOrder, customer: { email: order.customer.email, telephone: order.customer.telephone } };
            } else {
                if (returnableOrder.length !== 1) {
                    throw new cinerino.factory.errors.Argument('object.order', 'number of order must be 1');
                }

                const returnableOrderCustomer = returnableOrder[0].customer;
                if (returnableOrderCustomer === undefined) {
                    throw new cinerino.factory.errors.ArgumentNull('Order Customer', 'Order customer info required');
                }
                if (returnableOrderCustomer.email === undefined && returnableOrderCustomer.telephone === undefined) {
                    throw new cinerino.factory.errors.ArgumentNull('Order Customer', 'Order customer info required');
                }

                // 管理者でない場合は、個人情報完全一致で承認
                const orders = await orderRepo.search({
                    orderNumbers: returnableOrder.map((o) => o.orderNumber),
                    customer: {
                        email: (returnableOrderCustomer.email !== undefined)
                            ? `^${escapeRegExp(returnableOrderCustomer.email)}$`
                            : undefined,
                        telephone: (returnableOrderCustomer.telephone !== undefined)
                            ? `^${escapeRegExp(returnableOrderCustomer.telephone)}$`
                            : undefined
                    }
                });
                order = orders.shift();
                if (order === undefined) {
                    throw new cinerino.factory.errors.NotFound('Order');
                }
                returnableOrder = [order];
            }

            const cancellationFee = (req.isAdmin)
                ? 0
                : CANCELLATION_FEE;

            const reason = (req.isAdmin)
                ? cinerino.factory.transaction.returnOrder.Reason.Seller
                : cinerino.factory.transaction.returnOrder.Reason.Customer;

            const transaction = await cinerino.service.transaction.returnOrder.start({
                project: req.project,
                agent: {
                    ...req.agent,
                    identifier: [
                        ...(Array.isArray(req.agent.identifier)) ? req.agent.identifier : [],
                        ...(req.body.agent !== undefined && Array.isArray(req.body.agent.identifier))
                            ? (<any[]>req.body.agent.identifier).map((p: any) => {
                                return { name: String(p.name), value: String(p.value) };
                            })
                            : []
                    ]
                },
                expires: req.body.expires,
                object: {
                    cancellationFee: cancellationFee,
                    order: returnableOrder,
                    reason: reason
                },
                seller: order.seller
            })({
                action: actionRepo,
                invoice: invoiceRepo,
                order: orderRepo,
                project: projectRepo,
                transaction: transactionRepo
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

/**
 * 取引人プロフィール変更
 */
// tslint:disable-next-line:use-default-type-parameter
returnOrderTransactionsRouter.put<ParamsDictionary>(
    '/:transactionId/agent',
    permitScopes(['transactions']),
    ...[
        body('additionalProperty')
            .optional()
            .isArray({ max: 10 }),
        body('additionalProperty.*.name')
            .optional()
            .not()
            .isEmpty()
            .isString()
            .isLength({ max: ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH }),
        body('additionalProperty.*.value')
            .optional()
            .not()
            .isEmpty()
            .isString()
            .isLength({ max: ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH })
    ],
    validator,
    async (req, res, next) => {
        await rateLimit4transactionInProgress({
            typeOf: cinerino.factory.transactionType.ReturnOrder,
            id: req.params.transactionId
        })(req, res, next);
    },
    async (req, res, next) => {
        await lockTransaction({
            typeOf: cinerino.factory.transactionType.ReturnOrder,
            id: req.params.transactionId
        })(req, res, next);
    },
    async (req, res, next) => {
        try {
            await cinerino.service.transaction.updateAgent({
                typeOf: cinerino.factory.transactionType.ReturnOrder,
                id: req.params.transactionId,
                agent: {
                    ...req.body,
                    typeOf: cinerino.factory.personType.Person,
                    id: req.user.sub
                }
            })({
                transaction: new cinerino.repository.Transaction(mongoose.connection)
            });

            res.status(NO_CONTENT)
                .end();
        } catch (error) {
            next(error);
        }
    }
);

// tslint:disable-next-line:use-default-type-parameter
returnOrderTransactionsRouter.put<ParamsDictionary>(
    '/:transactionId/confirm',
    permitScopes(['transactions', 'pos']),
    rateLimit,
    ...[
        // Eメールカスタマイズのバリデーション
        body([
            'potentialActions.returnOrder.potentialActions.refundCreditCard.potentialActions.sendEmailMessage.object.about',
            'potentialActions.returnOrder.potentialActions.refundCreditCard.potentialActions.sendEmailMessage.object.template',
            'potentialActions.returnOrder.potentialActions.refundCreditCard.potentialActions.sendEmailMessage.object.sender.email',
            // tslint:disable-next-line:max-line-length
            'potentialActions.returnOrder.potentialActions.refundCreditCard.potentialActions.sendEmailMessage.object.toRecipient.email'
        ])
            .optional()
            .not()
            .isEmpty()
            .withMessage((_, options) => `${options.path} must not be empty`)
            .isString()
    ],
    validator,
    async (req, res, next) => {
        try {
            const actionRepo = new cinerino.repository.Action(mongoose.connection);
            const orderRepo = new cinerino.repository.Order(mongoose.connection);
            const projectRepo = new cinerino.repository.Project(mongoose.connection);
            const taskRepo = new cinerino.repository.Task(mongoose.connection);
            const transactionRepo = new cinerino.repository.Transaction(mongoose.connection);

            await cinerino.service.transaction.returnOrder.confirm({
                ...req.body,
                id: req.params.transactionId,
                agent: { id: req.user.sub }
            })({
                action: actionRepo,
                order: orderRepo,
                transaction: transactionRepo
            });

            // 非同期でタスクエクスポート(APIレスポンスタイムに影響を与えないように)
            // tslint:disable-next-line:no-floating-promises
            cinerino.service.transaction.exportTasks({
                project: req.project,
                status: cinerino.factory.transactionStatusType.Confirmed,
                typeOf: { $in: [cinerino.factory.transactionType.ReturnOrder] }
            })({
                project: projectRepo,
                task: taskRepo,
                transaction: transactionRepo
            })
                .then(async (tasks) => {
                    // タスクがあればすべて実行
                    if (Array.isArray(tasks)) {
                        await Promise.all(tasks.map(async (task) => {
                            await cinerino.service.task.executeByName(task)({
                                connection: mongoose.connection,
                                redisClient: redis.getClient()
                            });
                        }));
                    }
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
    permitScopes(['transactions.*', 'transactions.read']),
    rateLimit,
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
                project: { id: { $eq: req.project.id } },
                // tslint:disable-next-line:no-magic-numbers
                limit: (req.query.limit !== undefined) ? Math.min(req.query.limit, 100) : 100,
                page: (req.query.page !== undefined) ? Math.max(req.query.page, 1) : 1,
                typeOf: cinerino.factory.transactionType.ReturnOrder
            };
            const transactions = await transactionRepo.search(searchConditions);

            res.json(transactions);
        } catch (error) {
            next(error);
        }
    }
);

export default returnOrderTransactionsRouter;
