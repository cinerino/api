/**
 * 注文返品取引ルーター
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';
// tslint:disable-next-line:no-implicit-dependencies
import { ParamsDictionary } from 'express-serve-static-core';
// tslint:disable-next-line:no-submodule-imports
import { body, query } from 'express-validator/check';
import { NO_CONTENT } from 'http-status';
import * as mongoose from 'mongoose';

import authentication from '../../middlewares/authentication';
import permitScopes from '../../middlewares/permitScopes';
import validator from '../../middlewares/validator';

import * as redis from '../../../redis';

const MULTI_TENANT_SUPPORTED = process.env.MULTI_TENANT_SUPPORTED === '1';

const returnOrderTransactionsRouter = Router();
returnOrderTransactionsRouter.use(authentication);

/**
 * 正規表現をエスケープする
 */
function escapeRegExp(params: string) {
    return params.replace(/[.*+?^=!:${}()|[\]\/\\]/g, '\\$&');
}

returnOrderTransactionsRouter.post(
    '/start',
    permitScopes(['admin']),
    ...[
        body('expires')
            .not()
            .isEmpty()
            .withMessage((_, __) => 'required')
            .isISO8601()
            .toDate(),
        body('object.order.orderNumber')
            .not()
            .isEmpty()
            .withMessage((_, __) => 'required')
    ],
    validator,
    async (req, res, next) => {
        try {
            const actionRepo = new cinerino.repository.Action(mongoose.connection);
            const invoiceRepo = new cinerino.repository.Invoice(mongoose.connection);
            const orderRepo = new cinerino.repository.Order(mongoose.connection);
            const projectRepo = new cinerino.repository.Project(mongoose.connection);
            const sellerRepo = new cinerino.repository.Seller(mongoose.connection);
            const transactionRepo = new cinerino.repository.Transaction(mongoose.connection);

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

                // 管理者でない場合は、個人情報完全一致で承認
                const orders = await orderRepo.search({
                    orderNumbers: [returnableOrder.orderNumber],
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
                returnableOrder = order;
            }

            const transaction = await cinerino.service.transaction.returnOrder.start({
                project: req.project,
                expires: req.body.expires,
                agent: {
                    ...req.agent,
                    identifier: [
                        ...(req.agent.identifier !== undefined) ? req.agent.identifier : [],
                        ...(req.body.agent !== undefined && Array.isArray(req.body.agent.identifier))
                            ? (<any[]>req.body.agent.identifier).map((p: any) => {
                                return { name: String(p.name), value: String(p.value) };
                            })
                            : []
                    ]
                },
                object: {
                    order: returnableOrder,
                    clientUser: req.user,
                    cancellationFee: 0,
                    // forcibly: true,
                    reason: cinerino.factory.transaction.returnOrder.Reason.Seller
                },
                seller: order.seller
            })({
                action: actionRepo,
                invoice: invoiceRepo,
                seller: sellerRepo,
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

// tslint:disable-next-line:use-default-type-parameter
returnOrderTransactionsRouter.put<ParamsDictionary>(
    '/:transactionId/confirm',
    permitScopes(['admin']),
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
            const sellerRepo = new cinerino.repository.Seller(mongoose.connection);
            const taskRepo = new cinerino.repository.Task(mongoose.connection);
            const transactionRepo = new cinerino.repository.Transaction(mongoose.connection);

            await cinerino.service.transaction.returnOrder.confirm({
                ...req.body,
                id: req.params.transactionId,
                agent: { id: req.user.sub }
            })({
                action: actionRepo,
                transaction: transactionRepo,
                seller: sellerRepo
            });

            // 非同期でタスクエクスポート(APIレスポンスタイムに影響を与えないように)
            // tslint:disable-next-line:no-floating-promises
            cinerino.service.transaction.returnOrder.exportTasks({
                project: (MULTI_TENANT_SUPPORTED) ? req.project : undefined,
                status: cinerino.factory.transactionStatusType.Confirmed
            })({
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
                project: (MULTI_TENANT_SUPPORTED) ? { ids: [req.project.id] } : undefined,
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
