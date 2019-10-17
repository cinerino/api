/**
 * 注文返品取引ルーター
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';
// tslint:disable-next-line:no-implicit-dependencies
import { ParamsDictionary } from 'express-serve-static-core';
// tslint:disable-next-line:no-submodule-imports
import { body, query } from 'express-validator/check';
import { CREATED } from 'http-status';
import * as moment from 'moment';
import * as mongoose from 'mongoose';

const returnOrderTransactionsRouter = Router();

import authentication from '../../../middlewares/authentication';
import permitScopes from '../../../middlewares/permitScopes';
import validator from '../../../middlewares/validator';

returnOrderTransactionsRouter.use(authentication);

/**
 * 上映日と購入番号で返品
 */
returnOrderTransactionsRouter.post(
    '/confirm',
    permitScopes(['transactions']),
    ...[
        body('performance_day')
            .not()
            .isEmpty()
            .withMessage(() => 'required'),
        body('payment_no')
            .not()
            .isEmpty()
            .withMessage(() => 'required'),
        body('cancellation_fee')
            .not()
            .isEmpty()
            .withMessage(() => 'required')
            .isInt()
    ],
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

            // 確認番号で注文検索
            const confirmationNumber = `${req.body.performance_day}${req.body.payment_no}`;
            const orders = await orderRepo.search({
                limit: 1,
                confirmationNumbers: [confirmationNumber],
                project: { ids: [req.project.id] }
            });
            const order = orders.shift();
            if (order === undefined) {
                throw new cinerino.factory.errors.NotFound('Order');
            }

            // 注文取引を検索する
            const placeOrderTransactions = await transactionRepo.search<cinerino.factory.transactionType.PlaceOrder>({
                limit: 1,
                typeOf: cinerino.factory.transactionType.PlaceOrder,
                result: { order: { orderNumbers: [order.orderNumber] } }
            });
            const placeOrderTransaction = placeOrderTransactions.shift();
            if (placeOrderTransaction === undefined) {
                throw new cinerino.factory.errors.NotFound('Transaction');
            }

            // tslint:disable-next-line:max-line-length
            const authorizeSeatReservationActions = <cinerino.factory.action.authorize.offer.seatReservation.IAction<cinerino.factory.service.webAPI.Identifier.Chevre>[]>
                placeOrderTransaction.object.authorizeActions
                    .filter(
                        (a) => a.object.typeOf
                            === cinerino.factory.action.authorize.offer.seatReservation.ObjectType.SeatReservation
                    )
                    .filter((a) => a.actionStatus === cinerino.factory.actionStatusType.CompletedActionStatus);

            // const informOrderUrl = `${req.protocol}://${req.hostname}/webhooks/onReturnOrder`;
            // const informReservationUrl = `${req.protocol}://${req.hostname}/webhooks/onReservationCancelled`;
            const informOrderUrl = <string>req.body.informOrderUrl;
            const informReservationUrl = <string>req.body.informReservationUrl;

            const actionsOnOrder = await actionRepo.searchByOrderNumber({ orderNumber: order.orderNumber });
            const payActions = <cinerino.factory.action.trade.pay.IAction<cinerino.factory.paymentMethodType>[]>actionsOnOrder
                .filter((a) => a.typeOf === cinerino.factory.actionType.PayAction)
                .filter((a) => a.actionStatus === cinerino.factory.actionStatusType.CompletedActionStatus);

            const emailCustomization = getEmailCustomization({
                placeOrderTransaction: placeOrderTransaction,
                reason: cinerino.factory.transaction.returnOrder.Reason.Customer
            });

            // クレジットカード返金アクション
            const refundCreditCardActionsParams: cinerino.factory.transaction.returnOrder.IRefundCreditCardParams[] =
                await Promise.all((<cinerino.factory.action.trade.pay.IAction<cinerino.factory.paymentMethodType.CreditCard>[]>payActions)
                    .filter((a) => a.object[0].paymentMethod.typeOf === cinerino.factory.paymentMethodType.CreditCard)
                    // tslint:disable-next-line:max-line-length
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
                                    ...(emailCustomization !== undefined)
                                        ? { object: emailCustomization }
                                        : {
                                            object: {
                                                toRecipient: {
                                                    email: <string>process.env.DEVELOPER_EMAIL
                                                }
                                            }
                                        }
                                },
                                // クレジットカード返金後に注文通知
                                informOrder: [
                                    { recipient: { url: informOrderUrl } }
                                ]
                            }
                        };
                    }));

            const confirmReservationParams: cinerino.factory.transaction.returnOrder.ICancelReservationParams[] =
                authorizeSeatReservationActions.map((authorizeSeatReservationAction) => {
                    if (authorizeSeatReservationAction.result === undefined) {
                        throw new cinerino.factory.errors.NotFound('Result of seat reservation authorize action');
                    }

                    const reserveTransaction = authorizeSeatReservationAction.result.responseBody;

                    return {
                        object: {
                            typeOf: reserveTransaction.typeOf,
                            id: reserveTransaction.id
                        },
                        potentialActions: {
                            cancelReservation: {
                                potentialActions: {
                                    informReservation: [
                                        { recipient: { url: informReservationUrl } }
                                    ]
                                }
                            }
                        }
                    };
                });

            // 注文通知パラメータを生成
            const informOrderParams: cinerino.factory.transaction.returnOrder.IInformOrderParams[] = [];

            const expires = moment()
                .add(1, 'minute')
                .toDate();

            const potentialActionParams: cinerino.factory.transaction.returnOrder.IPotentialActionsParams = {
                returnOrder: {
                    potentialActions: {
                        cancelReservation: confirmReservationParams,
                        informOrder: informOrderParams,
                        refundCreditCard: refundCreditCardActionsParams
                    }
                }
            };

            // 取引があれば、返品取引進行
            const returnOrderTransaction = await cinerino.service.transaction.returnOrder.start({
                project: req.project,
                agent: req.agent,
                expires: expires,
                object: {
                    cancellationFee: Number(req.body.cancellation_fee),
                    clientUser: req.user,
                    order: { orderNumber: order.orderNumber },
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

export function getEmailCustomization(params: {
    placeOrderTransaction: cinerino.factory.transaction.placeOrder.ITransaction;
    reason: cinerino.factory.transaction.returnOrder.Reason;
}) {
    // const placeOrderTransaction = returnOrderTransaction.object.transaction;
    if (params.placeOrderTransaction.result === undefined) {
        throw new cinerino.factory.errors.NotFound('PlaceOrder Transaction Result');
    }
    // const order = params.placeOrderTransaction.result.order;

    // let emailMessageAttributes: cinerino.factory.creativeWork.message.email.IAttributes;
    const emailMessage: cinerino.factory.creativeWork.message.email.ICreativeWork | undefined = undefined;

    switch (params.reason) {
        case cinerino.factory.transaction.returnOrder.Reason.Customer:
            // no op

            break;

        case cinerino.factory.transaction.returnOrder.Reason.Seller:
            // tslint:disable-next-line:no-suspicious-comment
            // TODO 二重送信対策
            // emailMessageAttributes = await createEmailMessage4sellerReason(params.placeOrderTransaction);
            // emailMessage = {
            //     typeOf: cinerino.factory.creativeWorkType.EmailMessage,
            //     identifier: `returnOrderTransaction-${order.orderNumber}`,
            //     name: `returnOrderTransaction-${order.orderNumber}`,
            //     sender: {
            //         typeOf: params.placeOrderTransaction.seller.typeOf,
            //         name: emailMessageAttributes.sender.name,
            //         email: emailMessageAttributes.sender.email
            //     },
            //     toRecipient: {
            //         typeOf: params.placeOrderTransaction.agent.typeOf,
            //         name: emailMessageAttributes.toRecipient.name,
            //         email: emailMessageAttributes.toRecipient.email
            //     },
            //     about: emailMessageAttributes.about,
            //     text: emailMessageAttributes.text
            // };

            break;

        default:
    }

    return emailMessage;
}

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
            const searchConditions: cinerino.factory.transaction.returnOrder.ISearchConditions = {
                ...req.query,
                // tslint:disable-next-line:no-magic-numbers
                limit: (req.query.limit !== undefined) ? Math.min(req.query.limit, 100) : 100,
                page: (req.query.page !== undefined) ? Math.max(req.query.page, 1) : 1,
                sort: (req.query.sort !== undefined) ? req.query.sort : { orderDate: cinerino.factory.sortType.Descending },
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
