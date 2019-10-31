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

returnOrderTransactionsRouter.use(authentication);

/**
 * 上映日と購入番号で返品
 */
returnOrderTransactionsRouter.post(
    '/confirm',
    permitScopes(['transactions', 'pos']),
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

            const informOrderUrl = <string>req.body.informOrderUrl;
            const informReservationUrl = <string>req.body.informReservationUrl;

            const actionsOnOrder = await actionRepo.searchByOrderNumber({ orderNumber: order.orderNumber });
            const payActions = <cinerino.factory.action.trade.pay.IAction<cinerino.factory.paymentMethodType>[]>actionsOnOrder
                .filter((a) => a.typeOf === cinerino.factory.actionType.PayAction)
                .filter((a) => a.actionStatus === cinerino.factory.actionStatusType.CompletedActionStatus);

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
