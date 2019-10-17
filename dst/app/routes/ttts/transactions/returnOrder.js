"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * 注文返品取引ルーター
 */
const cinerino = require("@cinerino/domain");
const express_1 = require("express");
// tslint:disable-next-line:no-submodule-imports
const check_1 = require("express-validator/check");
const http_status_1 = require("http-status");
const moment = require("moment");
const mongoose = require("mongoose");
const returnOrderTransactionsRouter = express_1.Router();
const authentication_1 = require("../../../middlewares/authentication");
const permitScopes_1 = require("../../../middlewares/permitScopes");
const validator_1 = require("../../../middlewares/validator");
returnOrderTransactionsRouter.use(authentication_1.default);
/**
 * 上映日と購入番号で返品
 */
returnOrderTransactionsRouter.post('/confirm', permitScopes_1.default(['transactions']), ...[
    check_1.body('performance_day')
        .not()
        .isEmpty()
        .withMessage(() => 'required'),
    check_1.body('payment_no')
        .not()
        .isEmpty()
        .withMessage(() => 'required'),
    check_1.body('cancellation_fee')
        .not()
        .isEmpty()
        .withMessage(() => 'required')
        .isInt()
], validator_1.default, 
// tslint:disable-next-line:max-func-body-length
(req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const actionRepo = new cinerino.repository.Action(mongoose.connection);
        const invoiceRepo = new cinerino.repository.Invoice(mongoose.connection);
        const orderRepo = new cinerino.repository.Order(mongoose.connection);
        const projectRepo = new cinerino.repository.Project(mongoose.connection);
        const sellerRepo = new cinerino.repository.Seller(mongoose.connection);
        const transactionRepo = new cinerino.repository.Transaction(mongoose.connection);
        // 確認番号で注文検索
        const confirmationNumber = `${req.body.performance_day}${req.body.payment_no}`;
        const orders = yield orderRepo.search({
            limit: 1,
            confirmationNumbers: [confirmationNumber],
            project: { ids: [req.project.id] }
        });
        const order = orders.shift();
        if (order === undefined) {
            throw new cinerino.factory.errors.NotFound('Order');
        }
        // 注文取引を検索する
        const placeOrderTransactions = yield transactionRepo.search({
            limit: 1,
            typeOf: cinerino.factory.transactionType.PlaceOrder,
            result: { order: { orderNumbers: [order.orderNumber] } }
        });
        const placeOrderTransaction = placeOrderTransactions.shift();
        if (placeOrderTransaction === undefined) {
            throw new cinerino.factory.errors.NotFound('Transaction');
        }
        // tslint:disable-next-line:max-line-length
        const authorizeSeatReservationActions = placeOrderTransaction.object.authorizeActions
            .filter((a) => a.object.typeOf
            === cinerino.factory.action.authorize.offer.seatReservation.ObjectType.SeatReservation)
            .filter((a) => a.actionStatus === cinerino.factory.actionStatusType.CompletedActionStatus);
        // const informOrderUrl = `${req.protocol}://${req.hostname}/webhooks/onReturnOrder`;
        // const informReservationUrl = `${req.protocol}://${req.hostname}/webhooks/onReservationCancelled`;
        const informOrderUrl = req.body.informOrderUrl;
        const informReservationUrl = req.body.informReservationUrl;
        const actionsOnOrder = yield actionRepo.searchByOrderNumber({ orderNumber: order.orderNumber });
        const payActions = actionsOnOrder
            .filter((a) => a.typeOf === cinerino.factory.actionType.PayAction)
            .filter((a) => a.actionStatus === cinerino.factory.actionStatusType.CompletedActionStatus);
        const emailCustomization = getEmailCustomization({
            placeOrderTransaction: placeOrderTransaction,
            reason: cinerino.factory.transaction.returnOrder.Reason.Customer
        });
        // クレジットカード返金アクション
        const refundCreditCardActionsParams = yield Promise.all(payActions
            .filter((a) => a.object[0].paymentMethod.typeOf === cinerino.factory.paymentMethodType.CreditCard)
            // tslint:disable-next-line:max-line-length
            .map((a) => __awaiter(void 0, void 0, void 0, function* () {
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
                    sendEmailMessage: Object.assign({}, (emailCustomization !== undefined)
                        ? { object: emailCustomization }
                        : {
                            object: {
                                toRecipient: {
                                    email: process.env.DEVELOPER_EMAIL
                                }
                            }
                        }),
                    // クレジットカード返金後に注文通知
                    informOrder: [
                        { recipient: { url: informOrderUrl } }
                    ]
                }
            };
        })));
        const confirmReservationParams = authorizeSeatReservationActions.map((authorizeSeatReservationAction) => {
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
        const informOrderParams = [];
        const expires = moment()
            .add(1, 'minute')
            .toDate();
        const potentialActionParams = {
            returnOrder: {
                potentialActions: {
                    cancelReservation: confirmReservationParams,
                    informOrder: informOrderParams,
                    refundCreditCard: refundCreditCardActionsParams
                }
            }
        };
        // 取引があれば、返品取引進行
        const returnOrderTransaction = yield cinerino.service.transaction.returnOrder.start({
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
        yield cinerino.service.transaction.returnOrder.confirm({
            id: returnOrderTransaction.id,
            potentialActions: potentialActionParams
        })({
            action: actionRepo,
            seller: sellerRepo,
            transaction: transactionRepo
        });
        res.status(http_status_1.CREATED)
            .json({
            id: returnOrderTransaction.id
        });
    }
    catch (error) {
        next(error);
    }
}));
function getEmailCustomization(params) {
    // const placeOrderTransaction = returnOrderTransaction.object.transaction;
    if (params.placeOrderTransaction.result === undefined) {
        throw new cinerino.factory.errors.NotFound('PlaceOrder Transaction Result');
    }
    // const order = params.placeOrderTransaction.result.order;
    // let emailMessageAttributes: cinerino.factory.creativeWork.message.email.IAttributes;
    const emailMessage = undefined;
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
exports.getEmailCustomization = getEmailCustomization;
/**
 * 返品メール送信
 */
// tslint:disable-next-line:use-default-type-parameter
returnOrderTransactionsRouter.post('/:transactionId/tasks/sendEmailNotification', permitScopes_1.default(['transactions']), ...[
    check_1.body('sender.name')
        .not()
        .isEmpty()
        .withMessage(() => 'required'),
    check_1.body('sender.email')
        .not()
        .isEmpty()
        .withMessage(() => 'required'),
    check_1.body('toRecipient.name')
        .not()
        .isEmpty()
        .withMessage(() => 'required'),
    check_1.body('toRecipient.email')
        .not()
        .isEmpty()
        .withMessage(() => 'required')
        .isEmail(),
    check_1.body('about')
        .not()
        .isEmpty()
        .withMessage(() => 'required'),
    check_1.body('text')
        .not()
        .isEmpty()
        .withMessage(() => 'required')
], validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const task = yield cinerino.service.transaction.returnOrder.sendEmail(req.params.transactionId, {
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
        })({
            task: new cinerino.repository.Task(mongoose.connection),
            transaction: new cinerino.repository.Transaction(mongoose.connection)
        });
        res.status(http_status_1.CREATED)
            .json(task);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * 取引検索
 */
returnOrderTransactionsRouter.get('', permitScopes_1.default(['admin']), ...[
    check_1.query('startFrom')
        .optional()
        .isISO8601()
        .toDate(),
    check_1.query('startThrough')
        .optional()
        .isISO8601()
        .toDate(),
    check_1.query('endFrom')
        .optional()
        .isISO8601()
        .toDate(),
    check_1.query('endThrough')
        .optional()
        .isISO8601()
        .toDate()
], validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const transactionRepo = new cinerino.repository.Transaction(mongoose.connection);
        const searchConditions = Object.assign(Object.assign({}, req.query), { 
            // tslint:disable-next-line:no-magic-numbers
            limit: (req.query.limit !== undefined) ? Math.min(req.query.limit, 100) : 100, page: (req.query.page !== undefined) ? Math.max(req.query.page, 1) : 1, sort: (req.query.sort !== undefined) ? req.query.sort : { orderDate: cinerino.factory.sortType.Descending }, typeOf: cinerino.factory.transactionType.ReturnOrder });
        const transactions = yield transactionRepo.search(searchConditions);
        const totalCount = yield transactionRepo.count(searchConditions);
        res.set('X-Total-Count', totalCount.toString());
        res.json(transactions);
    }
    catch (error) {
        next(error);
    }
}));
exports.default = returnOrderTransactionsRouter;
