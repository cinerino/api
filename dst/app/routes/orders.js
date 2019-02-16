"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * 注文ルーター
 */
const cinerino = require("@cinerino/domain");
const express_1 = require("express");
// tslint:disable-next-line:no-submodule-imports
const check_1 = require("express-validator/check");
const http_status_1 = require("http-status");
const mongoose = require("mongoose");
const authentication_1 = require("../middlewares/authentication");
const permitScopes_1 = require("../middlewares/permitScopes");
const validator_1 = require("../middlewares/validator");
const redis = require("../../redis");
const CODE_EXPIRES_IN_SECONDS = Number(process.env.CODE_EXPIRES_IN_SECONDS);
const chevreAuthClient = new cinerino.chevre.auth.ClientCredentials({
    domain: process.env.CHEVRE_AUTHORIZE_SERVER_DOMAIN,
    clientId: process.env.CHEVRE_CLIENT_ID,
    clientSecret: process.env.CHEVRE_CLIENT_SECRET,
    scopes: [],
    state: ''
});
const ordersRouter = express_1.Router();
ordersRouter.use(authentication_1.default);
/**
 * 注文作成
 */
ordersRouter.post('', permitScopes_1.default(['admin']), ...[
    check_1.body('orderNumber')
        .not()
        .isEmpty()
        .withMessage((_, options) => `${options.path} is required`)
], validator_1.default, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const actionRepo = new cinerino.repository.Action(mongoose.connection);
        const invoiceRepo = new cinerino.repository.Invoice(mongoose.connection);
        const orderRepo = new cinerino.repository.Order(mongoose.connection);
        const taskRepo = new cinerino.repository.Task(mongoose.connection);
        const transactionRepo = new cinerino.repository.Transaction(mongoose.connection);
        const orderNumber = req.body.orderNumber;
        // 注文検索
        const orders = yield orderRepo.search({
            limit: 1,
            orderNumbers: [orderNumber]
        });
        let order = orders.shift();
        // 注文未作成であれば作成
        if (order === undefined) {
            // 注文取引検索
            const placeOrderTransactions = yield transactionRepo.search({
                limit: 1,
                typeOf: cinerino.factory.transactionType.PlaceOrder,
                result: { order: { orderNumbers: [orderNumber] } }
            });
            const placeOrderTransaction = placeOrderTransactions.shift();
            if (placeOrderTransaction === undefined) {
                throw new cinerino.factory.errors.NotFound('Transaction');
            }
            const transactionResult = placeOrderTransaction.result;
            const orderActionAttributes = {
                typeOf: cinerino.factory.actionType.OrderAction,
                object: transactionResult.order,
                agent: req.agent,
                potentialActions: {}
            };
            yield cinerino.service.order.placeOrder(orderActionAttributes)({
                action: actionRepo,
                invoice: invoiceRepo,
                order: orderRepo,
                task: taskRepo,
                transaction: transactionRepo
            });
            order =
                placeOrderTransaction.result.order;
        }
        res.json(order);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * 注文配送
 */
ordersRouter.post('/:orderNumber/deliver', permitScopes_1.default(['admin']), validator_1.default, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const actionRepo = new cinerino.repository.Action(mongoose.connection);
        const orderRepo = new cinerino.repository.Order(mongoose.connection);
        const ownershipInfoRepo = new cinerino.repository.OwnershipInfo(mongoose.connection);
        const taskRepo = new cinerino.repository.Task(mongoose.connection);
        const orderNumber = req.params.orderNumber;
        // 注文検索
        const order = yield orderRepo.findByOrderNumber({
            orderNumber: orderNumber
        });
        if (order.orderStatus !== cinerino.factory.orderStatus.OrderDelivered) {
            // APIユーザーとして注文配送を実行する
            const sendOrderActionAttributes = {
                typeOf: cinerino.factory.actionType.SendAction,
                object: order,
                agent: req.agent,
                recipient: order.customer,
                potentialActions: {
                    sendEmailMessage: undefined
                }
            };
            yield cinerino.service.delivery.sendOrder(sendOrderActionAttributes)({
                action: actionRepo,
                order: orderRepo,
                ownershipInfo: ownershipInfoRepo,
                task: taskRepo
            });
        }
        res.status(http_status_1.NO_CONTENT)
            .end();
    }
    catch (error) {
        next(error);
    }
}));
/**
 * 確認番号で注文照会
 */
ordersRouter.post('/findByConfirmationNumber', permitScopes_1.default(['aws.cognito.signin.user.admin', 'orders', 'orders.read-only']), ...[
    check_1.body('confirmationNumber')
        .not()
        .isEmpty()
        .withMessage((_, options) => `${options.path} is required`),
    check_1.body('customer')
        .not()
        .isEmpty()
        .withMessage((_, options) => `${options.path} is required`)
], validator_1.default, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const customer = req.body.customer;
        if (customer.email !== undefined && customer.telephone !== undefined) {
            throw new cinerino.factory.errors.Argument('customer');
        }
        const orderRepo = new cinerino.repository.Order(mongoose.connection);
        const order = yield orderRepo.findByConfirmationNumber({
            confirmationNumber: req.body.confirmationNumber,
            customer: customer
        });
        res.json(order);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * 確認番号で注文アイテムに対してコードを発行する
 */
ordersRouter.post('/:orderNumber/ownershipInfos/authorize', permitScopes_1.default(['aws.cognito.signin.user.admin', 'orders', 'orders.read-only']), ...[
    check_1.body('customer')
        .not()
        .isEmpty()
        .withMessage((_, options) => `${options.path} is required`)
], validator_1.default, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const customer = req.body.customer;
        if (customer.email !== undefined && customer.telephone !== undefined) {
            throw new cinerino.factory.errors.Argument('customer');
        }
        const actionRepo = new cinerino.repository.Action(mongoose.connection);
        const orderRepo = new cinerino.repository.Order(mongoose.connection);
        const codeRepo = new cinerino.repository.Code(redis.getClient());
        const order = yield orderRepo.findByOrderNumber({ orderNumber: req.params.orderNumber });
        if (order.customer.email !== customer.email && order.customer.telephone !== customer.telephone) {
            throw new cinerino.factory.errors.Argument('customer');
        }
        // まだ配送済でない場合
        if (order.orderStatus !== cinerino.factory.orderStatus.OrderDelivered) {
            throw new cinerino.factory.errors.Argument('orderNumber', 'Not delivered yet');
        }
        // 配送サービスに問い合わせて、注文から所有権を検索
        const actionsOnOrder = yield actionRepo.searchByOrderNumber({ orderNumber: order.orderNumber });
        const sendOrderAction = actionsOnOrder
            .filter((a) => a.typeOf === cinerino.factory.actionType.SendAction)
            .filter((a) => a.object.typeOf === 'Order')
            .find((a) => a.actionStatus === cinerino.factory.actionStatusType.CompletedActionStatus);
        // まだ配送済でない場合
        if (sendOrderAction === undefined || sendOrderAction.result === undefined) {
            throw new cinerino.factory.errors.Argument('orderNumber', 'Not delivered yet');
        }
        // 配送された所有権情報を注文に付加する
        const ownershipInfos = sendOrderAction.result.ownershipInfos;
        const reservationIds = ownershipInfos
            .filter((o) => o.typeOfGood.typeOf === cinerino.factory.chevre.reservationType.EventReservation)
            .map((o) => o.typeOfGood.id);
        const reservationService = new cinerino.chevre.service.Reservation({
            endpoint: process.env.CHEVRE_ENDPOINT,
            auth: chevreAuthClient
        });
        const searchReservationsResult = yield reservationService.searchScreeningEventReservations({
            limit: reservationIds.length,
            ids: reservationIds
        });
        // 所有権に対してコード発行
        order.acceptedOffers = yield Promise.all(order.acceptedOffers.map((offer) => __awaiter(this, void 0, void 0, function* () {
            // 実際の予約データで置き換え
            const reservation = searchReservationsResult.data.find((r) => r.id === offer.itemOffered.id);
            if (reservation !== undefined) {
                offer.itemOffered = reservation;
            }
            // 所有権コード情報を追加
            const ownershipInfo = ownershipInfos
                .filter((o) => o.typeOfGood.typeOf === offer.itemOffered.typeOf)
                .find((o) => o.typeOfGood.id === offer.itemOffered.id);
            if (ownershipInfo !== undefined) {
                if (offer.itemOffered.typeOf === cinerino.factory.chevre.reservationType.EventReservation) {
                    offer.itemOffered.reservedTicket.ticketToken = yield codeRepo.publish({
                        data: ownershipInfo,
                        expiresInSeconds: CODE_EXPIRES_IN_SECONDS
                    });
                }
            }
            return offer;
        })));
        // 予約番号でChevreチェックイン
        let reservationNumbers = ownershipInfos
            .filter((o) => o.typeOfGood.typeOf === cinerino.factory.chevre.reservationType.EventReservation)
            .map((o) => o.typeOfGood.reservationNumber);
        reservationNumbers = [...new Set(reservationNumbers)];
        yield Promise.all(reservationNumbers.map((reservationNumber) => __awaiter(this, void 0, void 0, function* () {
            yield reservationService.checkInScreeningEventReservations({
                reservationNumber: reservationNumber
            });
        })));
        res.json(order);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * 注文に対するアクション検索
 */
ordersRouter.get('/:orderNumber/actions', permitScopes_1.default(['admin']), validator_1.default, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const actionRepo = new cinerino.repository.Action(mongoose.connection);
        const actions = yield actionRepo.searchByOrderNumber({
            orderNumber: req.params.orderNumber,
            sort: req.query.sort
        });
        res.json(actions);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * 注文検索
 */
ordersRouter.get('', permitScopes_1.default(['admin']), (req, __2, next) => {
    req.checkQuery('orderDateFrom')
        .optional()
        .isISO8601()
        .withMessage('must be ISO8601')
        .toDate();
    req.checkQuery('orderDateThrough')
        .optional()
        .isISO8601()
        .withMessage('must be ISO8601')
        .toDate();
    req.checkQuery('acceptedOffers.itemOffered.reservationFor.inSessionFrom')
        .optional()
        .isISO8601()
        .withMessage('must be ISO8601')
        .toDate();
    req.checkQuery('acceptedOffers.itemOffered.reservationFor.inSessionThrough')
        .optional()
        .isISO8601()
        .withMessage('must be ISO8601')
        .toDate();
    req.checkQuery('acceptedOffers.itemOffered.reservationFor.startFrom')
        .optional()
        .isISO8601()
        .withMessage('must be ISO8601')
        .toDate();
    req.checkQuery('acceptedOffers.itemOffered.reservationFor.startThrough')
        .optional()
        .isISO8601()
        .withMessage('must be ISO8601')
        .toDate();
    next();
}, validator_1.default, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const orderRepo = new cinerino.repository.Order(mongoose.connection);
        const searchConditions = Object.assign({}, req.query, { 
            // tslint:disable-next-line:no-magic-numbers
            limit: (req.query.limit !== undefined) ? Math.min(req.query.limit, 100) : 100, page: (req.query.page !== undefined) ? Math.max(req.query.page, 1) : 1, sort: (req.query.sort !== undefined) ? req.query.sort : { orderDate: cinerino.factory.sortType.Descending } });
        const orders = yield orderRepo.search(searchConditions);
        const totalCount = yield orderRepo.count(searchConditions);
        res.set('X-Total-Count', totalCount.toString());
        res.json(orders);
    }
    catch (error) {
        next(error);
    }
}));
exports.default = ordersRouter;
