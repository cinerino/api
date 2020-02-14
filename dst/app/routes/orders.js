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
 * 注文ルーター
 */
const cinerino = require("@cinerino/domain");
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const google_libphonenumber_1 = require("google-libphonenumber");
const http_status_1 = require("http-status");
const moment = require("moment");
const mongoose = require("mongoose");
const permitScopes_1 = require("../middlewares/permitScopes");
const rateLimit_1 = require("../middlewares/rateLimit");
const validator_1 = require("../middlewares/validator");
const connectMongo_1 = require("../../connectMongo");
const redis = require("../../redis");
const ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH = (process.env.ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH !== undefined)
    ? Number(process.env.ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH)
    // tslint:disable-next-line:no-magic-numbers
    : 256;
/**
 * 正規表現をエスケープする
 */
function escapeRegExp(params) {
    return params.replace(/[.*+?^=!:${}()|[\]\/\\]/g, '\\$&');
}
const chevreAuthClient = new cinerino.chevre.auth.ClientCredentials({
    domain: process.env.CHEVRE_AUTHORIZE_SERVER_DOMAIN,
    clientId: process.env.CHEVRE_CLIENT_ID,
    clientSecret: process.env.CHEVRE_CLIENT_SECRET,
    scopes: [],
    state: ''
});
const ordersRouter = express_1.Router();
// const isNotAdmin: CustomValidator = (_, { req }) => !req.isAdmin;
/**
 * 注文検索
 */
ordersRouter.get('', permitScopes_1.default(['orders.*', 'orders.read']), rateLimit_1.default, ...[
    express_validator_1.query('disableTotalCount')
        .optional()
        .isBoolean()
        .toBoolean(),
    express_validator_1.query('identifier.$all')
        .optional()
        .isArray(),
    express_validator_1.query('identifier.$in')
        .optional()
        .isArray(),
    express_validator_1.query('identifier.$all.*.name')
        .optional()
        .not()
        .isEmpty()
        .isString()
        .isLength({ max: ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH }),
    express_validator_1.query('identifier.$all.*.value')
        .optional()
        .not()
        .isEmpty()
        .isString()
        .isLength({ max: ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH }),
    express_validator_1.query('identifier.$in.*.name')
        .optional()
        .not()
        .isEmpty()
        .isString()
        .isLength({ max: ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH }),
    express_validator_1.query('identifier.$in.*.value')
        .optional()
        .not()
        .isEmpty()
        .isString()
        .isLength({ max: ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH }),
    express_validator_1.query('orderDateFrom')
        .optional()
        .isISO8601()
        .toDate(),
    express_validator_1.query('orderDateThrough')
        .optional()
        .isISO8601()
        .toDate(),
    // .custom((value, { req }) => {
    //     // 注文期間指定を限定
    //     const orderDateThrough = moment(value);
    //     if (req.query !== undefined) {
    //         const orderDateThroughExpectedToBe = moment(req.query.orderDateFrom)
    //             // tslint:disable-next-line:no-magic-numbers
    //             .add(31, 'days');
    //         if (orderDateThrough.isAfter(orderDateThroughExpectedToBe)) {
    //             throw new Error('Order date range too large');
    //         }
    //     }
    //     return true;
    // }),
    express_validator_1.query('orderDate.$gte')
        .optional()
        .isISO8601()
        .toDate(),
    express_validator_1.query('orderDate.$lte')
        .optional()
        .isISO8601()
        .toDate(),
    express_validator_1.query('acceptedOffers.itemOffered.reservationFor.inSessionFrom')
        .optional()
        .isISO8601()
        .toDate(),
    express_validator_1.query('acceptedOffers.itemOffered.reservationFor.inSessionThrough')
        .optional()
        .isISO8601()
        .toDate(),
    express_validator_1.query('acceptedOffers.itemOffered.reservationFor.startFrom')
        .optional()
        .isISO8601()
        .toDate(),
    express_validator_1.query('acceptedOffers.itemOffered.reservationFor.startThrough')
        .optional()
        .isISO8601()
        .toDate(),
    express_validator_1.query('price.$gte')
        .optional()
        .isInt()
        .toInt(),
    express_validator_1.query('price.$lte')
        .optional()
        .isInt()
        .toInt()
], validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const orderRepo = new cinerino.repository.Order(mongoose.connection);
        const searchConditions = Object.assign(Object.assign({}, req.query), { project: { id: { $eq: req.project.id } }, 
            // tslint:disable-next-line:no-magic-numbers
            limit: (req.query.limit !== undefined) ? Math.min(req.query.limit, 100) : 100, page: (req.query.page !== undefined) ? Math.max(req.query.page, 1) : 1 });
        const orders = yield orderRepo.search(searchConditions);
        res.json(orders);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * 識別子で注文検索
 */
ordersRouter.get('/findByIdentifier', permitScopes_1.default(['orders.*', 'orders.read', 'orders.findByIdentifier']), rateLimit_1.default, ...[
    express_validator_1.query('identifier.$all')
        .optional()
        .isArray(),
    express_validator_1.query('identifier.$in')
        .optional()
        .isArray(),
    express_validator_1.query('identifier.$all.*.name')
        .optional()
        .not()
        .isEmpty()
        .isString()
        .isLength({ max: ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH }),
    express_validator_1.query('identifier.$all.*.value')
        .optional()
        .not()
        .isEmpty()
        .isString()
        .isLength({ max: ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH }),
    express_validator_1.query('identifier.$in.*.name')
        .optional()
        .not()
        .isEmpty()
        .isString()
        .isLength({ max: ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH }),
    express_validator_1.query('identifier.$in.*.value')
        .optional()
        .not()
        .isEmpty()
        .isString()
        .isLength({ max: ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH }),
    express_validator_1.query('identifier.$all')
        .not()
        .isEmpty()
        .withMessage(() => 'required')
        .isArray({ min: 2, max: 10 })
        .withMessage(() => 'must be specified at least 2')
], validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const orderRepo = new cinerino.repository.Order(mongoose.connection);
        // 検索条件を限定
        const orderDateThrough = moment()
            .toDate();
        const orderDateFrom = moment(orderDateThrough)
            // tslint:disable-next-line:no-magic-numbers
            .add(-93, 'days') // とりあえず直近3カ月をデフォルト動作に設定
            .toDate();
        const searchConditions = {
            project: { id: { $eq: req.project.id } },
            // tslint:disable-next-line:no-magic-numbers
            limit: (req.query.limit !== undefined) ? Math.min(req.query.limit, 100) : 100,
            page: (req.query.page !== undefined) ? Math.max(req.query.page, 1) : 1,
            sort: { orderDate: cinerino.factory.sortType.Descending },
            identifier: {
                $all: req.query.identifier.$all
            },
            orderDateFrom: orderDateFrom,
            orderDateThrough: orderDateThrough
        };
        const orders = yield orderRepo.search(searchConditions);
        res.json(orders);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * 注文作成
 */
ordersRouter.post('', permitScopes_1.default(['orders.*', 'orders.create']), rateLimit_1.default, ...[
    express_validator_1.body('orderNumber')
        .not()
        .isEmpty()
        .withMessage((_, __) => 'required')
], validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
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
            project: { id: { $eq: req.project.id } },
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
                agent: req.agent,
                object: transactionResult.order,
                potentialActions: {},
                project: placeOrderTransaction.project,
                typeOf: cinerino.factory.actionType.OrderAction
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
 * ストリーミングダウンロード
 */
ordersRouter.get('/download', permitScopes_1.default([]), rateLimit_1.default, ...[
    express_validator_1.query('orderDateFrom')
        .not()
        .isEmpty()
        .isISO8601()
        .toDate(),
    express_validator_1.query('orderDateThrough')
        .not()
        .isEmpty()
        .isISO8601()
        .toDate(),
    express_validator_1.query('orderDate.$gte')
        .optional()
        .isISO8601()
        .toDate(),
    express_validator_1.query('orderDate.$lte')
        .optional()
        .isISO8601()
        .toDate(),
    express_validator_1.query('acceptedOffers.itemOffered.reservationFor.inSessionFrom')
        .optional()
        .isISO8601()
        .toDate(),
    express_validator_1.query('acceptedOffers.itemOffered.reservationFor.inSessionThrough')
        .optional()
        .isISO8601()
        .toDate(),
    express_validator_1.query('acceptedOffers.itemOffered.reservationFor.startFrom')
        .optional()
        .isISO8601()
        .toDate(),
    express_validator_1.query('acceptedOffers.itemOffered.reservationFor.startThrough')
        .optional()
        .isISO8601()
        .toDate()
], validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    let connection;
    try {
        connection = yield connectMongo_1.connectMongo({
            defaultConnection: false,
            disableCheck: true
        });
        const orderRepo = new cinerino.repository.Order(connection);
        const searchConditions = Object.assign(Object.assign({}, req.query), { project: { id: { $eq: req.project.id } } });
        const format = req.query.format;
        const stream = yield cinerino.service.report.order.stream({
            conditions: searchConditions,
            format: format
        })({ order: orderRepo });
        res.type(`${req.query.format}; charset=utf-8`);
        stream.pipe(res)
            .on('error', () => __awaiter(void 0, void 0, void 0, function* () {
            if (connection !== undefined) {
                yield connection.close();
            }
        }))
            .on('finish', () => __awaiter(void 0, void 0, void 0, function* () {
            if (connection !== undefined) {
                yield connection.close();
            }
        }));
    }
    catch (error) {
        if (connection !== undefined) {
            yield connection.close();
        }
        next(error);
    }
}));
/**
 * 確認番号と電話番号で注文照会
 * @deprecated 基本的にシネマサンシャイン互換性維持のためのエンドポイント
 */
ordersRouter.post('/findByOrderInquiryKey', permitScopes_1.default(['orders.*', 'orders.read', 'orders.findByConfirmationNumber']), rateLimit_1.default, ...[
    express_validator_1.body('theaterCode')
        .not()
        .isEmpty()
        .withMessage((_, __) => 'required'),
    express_validator_1.body('confirmationNumber')
        .not()
        .isEmpty()
        .withMessage((_, __) => 'required'),
    express_validator_1.body('telephone')
        .not()
        .isEmpty()
        .withMessage((_, __) => 'required')
], validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const phoneUtil = google_libphonenumber_1.PhoneNumberUtil.getInstance();
        const phoneNumber = phoneUtil.parse(req.body.telephone, 'JP');
        if (!phoneUtil.isValidNumber(phoneNumber)) {
            next(new cinerino.factory.errors.Argument('telephone', 'Invalid phone number format'));
            return;
        }
        const key = {
            theaterCode: req.body.theaterCode,
            reservationNumber: Number(req.body.confirmationNumber),
            telephone: phoneUtil.format(phoneNumber, google_libphonenumber_1.PhoneNumberFormat.E164)
        };
        const orderRepo = new cinerino.repository.Order(mongoose.connection);
        // 劇場枝番号、予約番号、個人情報完全一致で検索する
        const orders = yield orderRepo.search({
            limit: 1,
            sort: { orderDate: cinerino.factory.sortType.Descending },
            customer: { telephone: `^${escapeRegExp(key.telephone)}$` },
            acceptedOffers: {
                itemOffered: {
                    reservationFor: { superEvent: { location: { branchCodes: [key.theaterCode] } } },
                    reservationNumbers: [key.reservationNumber.toString()]
                }
            }
        });
        const order = orders.shift();
        if (order === undefined) {
            // まだ注文が作成されていなければ、注文取引から検索するか検討中だが、いまのところ取引検索条件が足りない...
            throw new cinerino.factory.errors.NotFound('Order');
        }
        res.json(order);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * 確認番号で注文照会
 */
ordersRouter.post('/findByConfirmationNumber', permitScopes_1.default(['orders.*', 'orders.read', 'orders.findByConfirmationNumber']), rateLimit_1.default, ...[
    express_validator_1.query('orderDateFrom')
        .optional()
        .isISO8601()
        .toDate(),
    express_validator_1.query('orderDateThrough')
        .optional()
        .isISO8601()
        .toDate(),
    express_validator_1.body('orderDateFrom')
        .optional()
        .isISO8601()
        .toDate(),
    express_validator_1.body('orderDateThrough')
        .optional()
        .isISO8601()
        .toDate(),
    express_validator_1.body('orderDate.$gte')
        .optional()
        .isISO8601()
        .toDate(),
    express_validator_1.body('orderDate.$lte')
        .optional()
        .isISO8601()
        .toDate(),
    express_validator_1.body('confirmationNumber')
        .not()
        .isEmpty()
        .withMessage((_, __) => 'required'),
    express_validator_1.body('customer')
        .not()
        .isEmpty()
        .withMessage((_, __) => 'required')
], validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const customer = req.body.customer;
        if (customer.email !== undefined && customer.telephone !== undefined) {
            throw new cinerino.factory.errors.Argument('customer');
        }
        // 個人情報完全一致で検索する
        const orderRepo = new cinerino.repository.Order(mongoose.connection);
        const orderDateThrough = (req.query.orderDateThrough instanceof Date)
            ? req.query.orderDateThrough
            : (req.body.orderDateThrough instanceof Date)
                ? req.body.orderDateThrough
                : moment()
                    .toDate();
        const orderDateFrom = (req.query.orderDateFrom instanceof Date)
            ? req.query.orderDateFrom
            : (req.body.orderDateFrom instanceof Date)
                ? req.body.orderDateFrom
                : moment(orderDateThrough)
                    // tslint:disable-next-line:no-magic-numbers
                    .add(-3, 'months') // とりあえず直近3カ月をデフォルト動作に設定
                    .toDate();
        const orders = yield orderRepo.search({
            limit: 1,
            sort: { orderDate: cinerino.factory.sortType.Descending },
            project: { id: { $eq: req.project.id } },
            confirmationNumbers: [req.body.confirmationNumber],
            customer: {
                email: (customer.email !== undefined)
                    ? `^${escapeRegExp(customer.email)}$`
                    : undefined,
                telephone: (customer.telephone !== undefined)
                    ? `^${escapeRegExp(customer.telephone)}$`
                    : undefined
            },
            orderDateFrom: orderDateFrom,
            orderDateThrough: orderDateThrough
        });
        const order = orders.shift();
        if (order === undefined) {
            // まだ注文が作成されていなければ、注文取引から検索するか検討中だが、いまのところ取引検索条件が足りない...
            throw new cinerino.factory.errors.NotFound('Order');
        }
        res.json(order);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * 注文取得
 */
ordersRouter.get('/:orderNumber', permitScopes_1.default(['orders.*', 'orders.read']), rateLimit_1.default, validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const orderRepo = new cinerino.repository.Order(mongoose.connection);
        const order = yield orderRepo.findByOrderNumber({
            orderNumber: req.params.orderNumber
        });
        res.json(order);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * 注文配送
 */
ordersRouter.post('/:orderNumber/deliver', permitScopes_1.default(['orders.*', 'orders.deliver']), rateLimit_1.default, validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const actionRepo = new cinerino.repository.Action(mongoose.connection);
        const orderRepo = new cinerino.repository.Order(mongoose.connection);
        const ownershipInfoRepo = new cinerino.repository.OwnershipInfo(mongoose.connection);
        const taskRepo = new cinerino.repository.Task(mongoose.connection);
        const registerActionInProgressRepo = new cinerino.repository.action.RegisterProgramMembershipInProgress(redis.getClient());
        const orderNumber = req.params.orderNumber;
        // 注文検索
        const order = yield orderRepo.findByOrderNumber({
            orderNumber: orderNumber
        });
        if (order.orderStatus !== cinerino.factory.orderStatus.OrderDelivered) {
            // APIユーザーとして注文配送を実行する
            const sendOrderActionAttributes = {
                agent: req.agent,
                object: order,
                potentialActions: {
                    sendEmailMessage: undefined
                },
                project: order.project,
                recipient: order.customer,
                typeOf: cinerino.factory.actionType.SendAction
            };
            yield cinerino.service.delivery.sendOrder(sendOrderActionAttributes)({
                action: actionRepo,
                order: orderRepo,
                ownershipInfo: ownershipInfoRepo,
                registerActionInProgress: registerActionInProgressRepo,
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
 * 確認番号で注文アイテムに対してコードを発行する
 */
// tslint:disable-next-line:use-default-type-parameter
ordersRouter.post('/:orderNumber/ownershipInfos/authorize', permitScopes_1.default(['orders.*', 'orders.read', 'orders.findByConfirmationNumber']), rateLimit_1.default, ...[
    express_validator_1.body('customer')
        .not()
        .isEmpty()
        .withMessage((_, __) => 'required')
], validator_1.default, 
// tslint:disable-next-line:max-func-body-length
(req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const now = new Date();
        const projectRepo = new cinerino.repository.Project(mongoose.connection);
        const project = yield projectRepo.findById({ id: req.project.id });
        const customer = req.body.customer;
        if (customer.email !== undefined && customer.telephone !== undefined) {
            throw new cinerino.factory.errors.Argument('customer');
        }
        const actionRepo = new cinerino.repository.Action(mongoose.connection);
        const orderRepo = new cinerino.repository.Order(mongoose.connection);
        const codeRepo = new cinerino.repository.Code(mongoose.connection);
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
        const ownershipInfos = (Array.isArray(sendOrderAction.result))
            ? sendOrderAction.result
            : sendOrderAction.result.ownershipInfos; // 旧型に対する互換性維持のため
        const reservationIds = ownershipInfos
            .filter((o) => o.typeOfGood.typeOf === cinerino.factory.chevre.reservationType.EventReservation)
            .map((o) => o.typeOfGood.id);
        if (project.settings === undefined) {
            throw new cinerino.factory.errors.ServiceUnavailable('Project settings undefined');
        }
        if (project.settings.chevre === undefined) {
            throw new cinerino.factory.errors.ServiceUnavailable('Project settings not found');
        }
        const reservationService = new cinerino.chevre.service.Reservation({
            endpoint: project.settings.chevre.endpoint,
            auth: chevreAuthClient
        });
        const searchReservationsResult = yield reservationService.search({
            limit: reservationIds.length,
            typeOf: cinerino.factory.chevre.reservationType.EventReservation,
            ids: reservationIds
        });
        // 所有権に対してコード発行
        order.acceptedOffers = yield Promise.all(order.acceptedOffers.map((offer) => __awaiter(void 0, void 0, void 0, function* () {
            const itemOffered = offer.itemOffered;
            if (itemOffered.typeOf === cinerino.factory.chevre.reservationType.EventReservation) {
                // 実際の予約データで置き換え
                const reservation = searchReservationsResult.data.find((r) => r.id === itemOffered.id);
                if (reservation !== undefined) {
                    // 所有権コード情報を追加
                    const ownershipInfo = ownershipInfos
                        .filter((o) => o.typeOfGood.typeOf === reservation.typeOf)
                        .find((o) => o.typeOfGood.id === reservation.id);
                    if (ownershipInfo !== undefined) {
                        const authorization = yield cinerino.service.code.publish({
                            project: req.project,
                            agent: req.agent,
                            recipient: req.agent,
                            object: ownershipInfo,
                            purpose: {},
                            validFrom: now
                        })({
                            action: actionRepo,
                            code: codeRepo,
                            project: projectRepo
                        });
                        reservation.reservedTicket.ticketToken = authorization.code;
                        offer.itemOffered = reservation;
                    }
                }
            }
            return offer;
        })));
        // 予約番号でChevreチェックイン
        let reservationNumbers = ownershipInfos
            .filter((o) => o.typeOfGood.typeOf === cinerino.factory.chevre.reservationType.EventReservation)
            .map((o) => o.typeOfGood.reservationNumber);
        reservationNumbers = [...new Set(reservationNumbers)];
        yield Promise.all(reservationNumbers.map((reservationNumber) => __awaiter(void 0, void 0, void 0, function* () {
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
ordersRouter.get('/:orderNumber/actions', permitScopes_1.default(['orders.*', 'orders.read']), rateLimit_1.default, validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
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
exports.default = ordersRouter;
