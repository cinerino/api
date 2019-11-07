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
 * 注文取引ルーター(ttts専用)
 */
const cinerino = require("@cinerino/domain");
const express_1 = require("express");
// tslint:disable-next-line:no-submodule-imports
const check_1 = require("express-validator/check");
const http_status_1 = require("http-status");
const moment = require("moment-timezone");
const mongoose = require("mongoose");
const placeOrderTransactionsRouter = express_1.Router();
const authentication_1 = require("../../../middlewares/authentication");
const permitScopes_1 = require("../../../middlewares/permitScopes");
const validator_1 = require("../../../middlewares/validator");
const redis = require("../../../../redis");
placeOrderTransactionsRouter.use(authentication_1.default);
/**
 * 座席仮予約
 */
placeOrderTransactionsRouter.post('/:transactionId/actions/authorize/seatReservation', permitScopes_1.default(['transactions', 'pos']), validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!Array.isArray(req.body.offers)) {
            req.body.offers = [];
        }
        const performanceId = req.body.performance_id;
        const action = yield cinerino.service.transaction.placeOrderInProgress.action.authorize.offer.seatReservation4ttts.create({
            project: req.project,
            agent: { id: req.user.sub },
            transaction: { id: req.params.transactionId },
            object: {
                event: { id: performanceId },
                acceptedOffer: [],
                acceptedOffers: req.body.offers.map((offer) => {
                    return {
                        ticket_type: offer.ticket_type,
                        watcher_name: offer.watcher_name
                    };
                })
            }
        })(new cinerino.repository.Action(mongoose.connection), new cinerino.repository.PaymentNo(redis.getClient()), new cinerino.repository.rateLimit.TicketTypeCategory(redis.getClient()), new cinerino.repository.Transaction(mongoose.connection), new cinerino.repository.Project(mongoose.connection));
        res.status(http_status_1.CREATED)
            .json(action);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * 座席仮予約削除
 */
placeOrderTransactionsRouter.delete('/:transactionId/actions/authorize/seatReservation/:actionId', permitScopes_1.default(['transactions', 'pos']), validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield cinerino.service.transaction.placeOrderInProgress.action.authorize.offer.seatReservation4ttts.cancel({
            project: req.project,
            agent: { id: req.user.sub },
            transaction: { id: req.params.transactionId },
            id: req.params.actionId
        })(new cinerino.repository.Transaction(mongoose.connection), new cinerino.repository.Action(mongoose.connection), new cinerino.repository.rateLimit.TicketTypeCategory(redis.getClient()), new cinerino.repository.Project(mongoose.connection));
        res.status(http_status_1.NO_CONTENT)
            .end();
    }
    catch (error) {
        next(error);
    }
}));
placeOrderTransactionsRouter.post('/:transactionId/confirm', permitScopes_1.default(['transactions', 'pos']), validator_1.default, 
// tslint:disable-next-line:max-func-body-length
(req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const actionRepo = new cinerino.repository.Action(mongoose.connection);
        const orderNumberRepo = new cinerino.repository.OrderNumber(redis.getClient());
        const sellerRepo = new cinerino.repository.Seller(mongoose.connection);
        const transactionRepo = new cinerino.repository.Transaction(mongoose.connection);
        const authorizeSeatReservationResult = yield getTmpReservations({
            transaction: { id: req.params.transactionId }
        })({
            action: actionRepo
        });
        const confirmationNumber = createConfirmationNumber({
            transactionId: req.params.transactionId,
            authorizeSeatReservationResult: authorizeSeatReservationResult
        });
        // let confirmReservationParams: cinerino.factory.transaction.placeOrder.IConfirmReservationParams[] = [];
        // let informOrderParams: cinerino.factory.transaction.placeOrder.IInformOrderParams[] = [];
        // アプリケーション側でpotentialActionsの指定があれば設定
        const potentialActionsParams = req.body.potentialActions;
        // if (potentialActionsParams !== undefined) {
        //     if (potentialActionsParams.order !== undefined) {
        //         if (potentialActionsParams.order.potentialActions !== undefined) {
        //             if (Array.isArray(potentialActionsParams.order.potentialActions.informOrder)) {
        //                 informOrderParams = potentialActionsParams.order.potentialActions.informOrder;
        //             }
        //             if (potentialActionsParams.order.potentialActions.sendOrder !== undefined) {
        //                 if (potentialActionsParams.order.potentialActions.sendOrder.potentialActions !== undefined) {
        //                     if (Array.isArray(
        //                         potentialActionsParams.order.potentialActions.sendOrder.potentialActions.confirmReservation
        //                     )) {
        //                         confirmReservationParams
        //                             = potentialActionsParams.order.potentialActions.sendOrder.potentialActions.confirmReservation;
        //                     }
        //                 }
        //             }
        //         }
        //     }
        // }
        // const potentialActions: cinerino.factory.transaction.placeOrder.IPotentialActionsParams = {
        //     order: {
        //         potentialActions: {
        //             sendOrder: {
        //                 potentialActions: {
        //                     confirmReservation: confirmReservationParams
        //                 }
        //             },
        //             informOrder: informOrderParams
        //         }
        //     }
        // };
        // 決済承認後に注文日時を確定しなければ、取引条件を満たさないので注意
        const orderDate = new Date();
        const result = yield cinerino.service.transaction.placeOrderInProgress.confirm({
            project: { typeOf: req.project.typeOf, id: req.project.id },
            agent: { id: req.user.sub },
            id: req.params.transactionId,
            potentialActions: potentialActionsParams,
            result: {
                order: {
                    orderDate: orderDate,
                    confirmationNumber: confirmationNumber
                }
            }
        })({
            action: actionRepo,
            orderNumber: orderNumberRepo,
            seller: sellerRepo,
            transaction: transactionRepo
        });
        res.status(http_status_1.CREATED)
            .json(result);
    }
    catch (error) {
        next(error);
    }
}));
function createConfirmationNumber(params) {
    const reserveTransaction = params.authorizeSeatReservationResult.responseBody;
    if (reserveTransaction === undefined) {
        throw new cinerino.factory.errors.Argument('Transaction', 'Reserve trasaction required');
    }
    const chevreReservations = (Array.isArray(reserveTransaction.object.reservations))
        ? reserveTransaction.object.reservations
        : [];
    const event = reserveTransaction.object.reservationFor;
    if (event === undefined || event === null) {
        throw new cinerino.factory.errors.Argument('Transaction', 'Event required');
    }
    // 確認番号を事前生成
    const eventStartDateStr = moment(event.startDate)
        .tz('Asia/Tokyo')
        .format('YYYYMMDD');
    let paymentNo;
    if (chevreReservations[0].underName !== undefined && Array.isArray(chevreReservations[0].underName.identifier)) {
        const paymentNoProperty = chevreReservations[0].underName.identifier.find((p) => p.name === 'paymentNo');
        if (paymentNoProperty !== undefined) {
            paymentNo = paymentNoProperty.value;
        }
    }
    if (paymentNo === undefined) {
        throw new cinerino.factory.errors.ServiceUnavailable('Payment No not found');
    }
    return `${eventStartDateStr}${paymentNo}`;
}
exports.createConfirmationNumber = createConfirmationNumber;
function getTmpReservations(params) {
    return (repos) => __awaiter(this, void 0, void 0, function* () {
        const authorizeActions = yield repos.action.searchByPurpose({
            typeOf: cinerino.factory.actionType.AuthorizeAction,
            purpose: {
                typeOf: cinerino.factory.transactionType.PlaceOrder,
                id: params.transaction.id
            }
        });
        const seatReservationAuthorizeActions = authorizeActions
            .filter((a) => a.actionStatus === cinerino.factory.actionStatusType.CompletedActionStatus)
            .filter((a) => a.object.typeOf === cinerino.factory.action.authorize.offer.seatReservation.ObjectType.SeatReservation);
        if (seatReservationAuthorizeActions.length > 1) {
            throw new cinerino.factory.errors.Argument('Transaction', 'Number of seat reservations must be 1');
        }
        const seatReservationAuthorizeAction = seatReservationAuthorizeActions.shift();
        if (seatReservationAuthorizeAction === undefined || seatReservationAuthorizeAction.result === undefined) {
            throw new cinerino.factory.errors.Argument('Transaction', 'Seat reservation authorize action required');
        }
        return seatReservationAuthorizeAction.result;
    });
}
exports.getTmpReservations = getTmpReservations;
// tslint:disable-next-line:use-default-type-parameter
placeOrderTransactionsRouter.post('/:transactionId/tasks/sendEmailNotification', permitScopes_1.default(['transactions']), ...[
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
        const task = yield cinerino.service.transaction.placeOrder.sendEmail(req.params.transactionId, {
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
exports.default = placeOrderTransactionsRouter;
