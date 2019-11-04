/**
 * 注文返品取引ルーター(ttts専用)
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';
// tslint:disable-next-line:no-implicit-dependencies
import { ParamsDictionary } from 'express-serve-static-core';
// tslint:disable-next-line:no-submodule-imports
import { body } from 'express-validator/check';
import { CREATED } from 'http-status';
import * as moment from 'moment';
import * as mongoose from 'mongoose';

const CANCELLATION_FEE = 1000;

const returnOrderTransactionsRouter = Router();

import authentication from '../../../middlewares/authentication';
import permitScopes from '../../../middlewares/permitScopes';
import validator from '../../../middlewares/validator';

/**
 * 正規表現をエスケープする
 */
function escapeRegExp(params: string) {
    return params.replace(/[.*+?^=!:${}()|[\]\/\\]/g, '\\$&');
}

returnOrderTransactionsRouter.use(authentication);

/**
 * 上映日と購入番号で返品
 */
returnOrderTransactionsRouter.post(
    '/confirm',
    permitScopes(['transactions', 'pos']),
    // ...[
    //     body('performance_day')
    //         .not()
    //         .isEmpty()
    //         .withMessage(() => 'required'),
    //     body('payment_no')
    //         .not()
    //         .isEmpty()
    //         .withMessage(() => 'required')
    // ],
    validator,
    // tslint:disable-next-line:max-func-body-length
    async (req, res, next) => {
        try {
            const actionRepo = new cinerino.repository.Action(mongoose.connection);
            const invoiceRepo = new cinerino.repository.Invoice(mongoose.connection);
            const orderRepo = new cinerino.repository.Order(mongoose.connection);
            const projectRepo = new cinerino.repository.Project(mongoose.connection);
            const sellerRepo = new cinerino.repository.Seller(mongoose.connection);
            const transactionRepo = new cinerino.repository.Transaction(mongoose.connection);

            let order: cinerino.factory.order.IOrder | undefined;
            let returnableOrder: cinerino.factory.transaction.returnOrder.IReturnableOrder;

            if (req.body.object !== undefined
                && req.body.object !== null
                && req.body.object.order !== undefined
                && req.body.object.order !== null) {
                returnableOrder = req.body.object.order;

                const returnableOrderCustomer = returnableOrder.customer;
                if (returnableOrderCustomer === undefined) {
                    throw new cinerino.factory.errors.ArgumentNull('Order Customer', 'Order customer info required');
                }
                if (returnableOrderCustomer.email === undefined && returnableOrderCustomer.telephone === undefined) {
                    throw new cinerino.factory.errors.ArgumentNull('Order Customer', 'Order customer info required');
                }

                // 個人情報完全一致で承認
                const orders = await orderRepo.search({
                    limit: 1,
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
            } else {
                const confirmationNumber = `${req.body.performance_day}${req.body.payment_no}`;
                const orders = await orderRepo.search({
                    limit: 1,
                    confirmationNumbers: [confirmationNumber],
                    project: { ids: [req.project.id] }
                });
                order = orders.shift();
                if (order === undefined) {
                    throw new cinerino.factory.errors.NotFound('Order');
                }

                returnableOrder = order;
            }

            const actionsOnOrder = await actionRepo.searchByOrderNumber({ orderNumber: order.orderNumber });
            const payActions = <cinerino.factory.action.trade.pay.IAction<cinerino.factory.paymentMethodType>[]>actionsOnOrder
                .filter((a) => a.typeOf === cinerino.factory.actionType.PayAction)
                .filter((a) => a.actionStatus === cinerino.factory.actionStatusType.CompletedActionStatus);

            // クレジットカード返金アクション
            const informOrderUrl = <string>req.body.informOrderUrl;
            const refundCreditCardActionsParams: cinerino.factory.transaction.returnOrder.IRefundCreditCardParams[] =
                await Promise.all((<cinerino.factory.action.trade.pay.IAction<cinerino.factory.paymentMethodType.CreditCard>[]>payActions)
                    .filter((a) => a.object[0].paymentMethod.typeOf === cinerino.factory.paymentMethodType.CreditCard)
                    .map(async (a) => {
                        return {
                            object: {
                                object: a.object.map((o) => {
                                    return {
                                        paymentMethod: {
                                            paymentMethodId: o.paymentMethod.paymentMethodId
                                        }
                                    };
                                })
                            },
                            potentialActions: {
                                sendEmailMessage: {
                                    // 返金メールは管理者へ
                                    object: {
                                        toRecipient: {
                                            email: <string>process.env.DEVELOPER_EMAIL
                                        }
                                    }
                                },
                                // クレジットカード返金後に注文通知
                                informOrder: [
                                    { recipient: { url: informOrderUrl } }
                                ]
                            }
                        };
                    })
                );

            const expires = moment()
                .add(1, 'minute')
                .toDate();

            const potentialActionParams: cinerino.factory.transaction.returnOrder.IPotentialActionsParams = {
                returnOrder: {
                    potentialActions: {
                        refundCreditCard: refundCreditCardActionsParams
                    }
                }
            };

            // 取引があれば、返品取引進行
            const returnOrderTransaction = await cinerino.service.transaction.returnOrder.start({
                project: req.project,
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
                expires: expires,
                object: {
                    cancellationFee: CANCELLATION_FEE,
                    clientUser: req.user,
                    order: returnableOrder,
                    reason: cinerino.factory.transaction.returnOrder.Reason.Customer
                },
                seller: { typeOf: order.seller.typeOf, id: order.seller.id }
            })({
                action: actionRepo,
                invoice: invoiceRepo,
                order: orderRepo,
                project: projectRepo,
                seller: sellerRepo,
                transaction: transactionRepo
            });

            await cinerino.service.transaction.returnOrder.confirm({
                id: returnOrderTransaction.id,
                potentialActions: potentialActionParams
            })({
                action: actionRepo,
                seller: sellerRepo,
                transaction: transactionRepo
            });

            res.status(CREATED)
                .json({
                    id: returnOrderTransaction.id
                });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * 返品メール送信
 */
// tslint:disable-next-line:use-default-type-parameter
returnOrderTransactionsRouter.post<ParamsDictionary>(
    '/:transactionId/tasks/sendEmailNotification',
    permitScopes(['transactions']),
    ...[
        body('sender.name')
            .not()
            .isEmpty()
            .withMessage(() => 'required'),
        body('sender.email')
            .not()
            .isEmpty()
            .withMessage(() => 'required'),
        body('toRecipient.name')
            .not()
            .isEmpty()
            .withMessage(() => 'required'),
        body('toRecipient.email')
            .not()
            .isEmpty()
            .withMessage(() => 'required')
            .isEmail(),
        body('about')
            .not()
            .isEmpty()
            .withMessage(() => 'required'),
        body('text')
            .not()
            .isEmpty()
            .withMessage(() => 'required')
    ],
    validator,
    async (req, res, next) => {
        try {
            const task = await cinerino.service.transaction.returnOrder.sendEmail(
                req.params.transactionId,
                {
                    typeOf: cinerino.factory.creativeWorkType.EmailMessage,
                    sender: {
                        name: req.body.sender.name,
                        email: req.body.sender.email
                    },
                    toRecipient: {
                        name: req.body.toRecipient.name,
                        email: req.body.toRecipient.email
                    },
                    about: req.body.about,
                    text: req.body.text
                }
            )({
                task: new cinerino.repository.Task(mongoose.connection),
                transaction: new cinerino.repository.Transaction(mongoose.connection)
            });

            res.status(CREATED)
                .json(task);
        } catch (error) {
            next(error);
        }
    }
);

export default returnOrderTransactionsRouter;
