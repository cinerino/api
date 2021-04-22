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
const redis = require("../../redis");
const CODE_EXPIRES_IN_SECONDS_DEFAULT = (typeof process.env.CODE_EXPIRES_IN_SECONDS_DEFAULT === 'string')
    ? Number(process.env.CODE_EXPIRES_IN_SECONDS_DEFAULT)
    // tslint:disable-next-line:no-magic-numbers
    : 600;
const CODE_EXPIRES_IN_SECONDS_MAXIMUM = (typeof process.env.CODE_EXPIRES_IN_SECONDS_MAXIMUM === 'string')
    ? Number(process.env.CODE_EXPIRES_IN_SECONDS_MAXIMUM)
    // tslint:disable-next-line:no-magic-numbers
    : 600;
const ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH = (process.env.ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH !== undefined)
    ? Number(process.env.ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH)
    // tslint:disable-next-line:no-magic-numbers
    : 256;
const chevreAuthClient = new cinerino.chevre.auth.ClientCredentials({
    domain: process.env.CHEVRE_AUTHORIZE_SERVER_DOMAIN,
    clientId: process.env.CHEVRE_CLIENT_ID,
    clientSecret: process.env.CHEVRE_CLIENT_SECRET,
    scopes: [],
    state: ''
});
const ordersRouter = express_1.Router();
/**
 * 管理者でないかどうかの判定を担うカスタムバリデータ
 */
const isNotAdmin = (__, { req }) => !req.isAdmin;
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
        const orderService = new cinerino.chevre.service.Order({
            endpoint: cinerino.credentials.chevre.endpoint,
            auth: chevreAuthClient
        });
        const searchConditions = Object.assign(Object.assign({}, req.query), { project: { id: { $eq: req.project.id } }, 
            // tslint:disable-next-line:no-magic-numbers
            limit: (req.query.limit !== undefined) ? Math.min(req.query.limit, 100) : 100, page: (req.query.page !== undefined) ? Math.max(req.query.page, 1) : 1 });
        const { data } = yield orderService.search(searchConditions);
        res.json(data);
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
        const orderService = new cinerino.chevre.service.Order({
            endpoint: cinerino.credentials.chevre.endpoint,
            auth: chevreAuthClient
        });
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
        const { data } = yield orderService.search(searchConditions);
        res.json(data);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * 注文作成
 */
ordersRouter.post('', permitScopes_1.default(['orders.*', 'orders.create']), rateLimit_1.default, ...[
    express_validator_1.body('object.orderNumber')
        .not()
        .isEmpty()
        .withMessage(() => 'required'),
    express_validator_1.body('object.confirmationNumber')
        .if(isNotAdmin)
        .not()
        .isEmpty()
        .withMessage(() => 'required'),
    express_validator_1.body('purpose.typeOf')
        .if(isNotAdmin)
        .not()
        .isEmpty()
        .withMessage(() => 'required'),
    express_validator_1.body('purpose.id')
        .if(isNotAdmin)
        .not()
        .isEmpty()
        .withMessage(() => 'required')
], validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e, _f;
    try {
        const actionRepo = new cinerino.repository.Action(mongoose.connection);
        const taskRepo = new cinerino.repository.Task(mongoose.connection);
        const transactionRepo = new cinerino.repository.Transaction(mongoose.connection);
        const orderNumber = (_a = req.body.object) === null || _a === void 0 ? void 0 : _a.orderNumber;
        // 注文検索
        const orderService = new cinerino.chevre.service.Order({
            endpoint: cinerino.credentials.chevre.endpoint,
            auth: chevreAuthClient
        });
        const searchOrdersResult = yield orderService.search({
            limit: 1,
            project: { id: { $eq: req.project.id } },
            orderNumbers: [orderNumber]
        });
        const order = searchOrdersResult.data.shift();
        // 注文未作成であれば作成
        if (order === undefined) {
            let placeOrderTransaction;
            if (req.isAdmin) {
                // 注文取引検索
                const placeOrderTransactions = yield transactionRepo.search({
                    limit: 1,
                    project: { id: { $eq: req.project.id } },
                    typeOf: cinerino.factory.transactionType.PlaceOrder,
                    statuses: [cinerino.factory.transactionStatusType.Confirmed],
                    result: { order: { orderNumbers: [orderNumber] } }
                });
                placeOrderTransaction = placeOrderTransactions.shift();
            }
            else {
                const confirmationNumber = (_b = req.body.object) === null || _b === void 0 ? void 0 : _b.confirmationNumber;
                const purposeTypeOf = (_c = req.body.purpose) === null || _c === void 0 ? void 0 : _c.typeOf;
                const purposeId = (_d = req.body.purpose) === null || _d === void 0 ? void 0 : _d.id;
                // 注文番号と確認番号で、注文取引を検索
                // if (typeof confirmationNumber !== 'string' || confirmationNumber.length === 0) {
                //     throw new cinerino.factory.errors.ArgumentNull('confirmationNumber');
                // }
                // 取引IDで検索
                placeOrderTransaction = yield transactionRepo.findById({
                    typeOf: purposeTypeOf,
                    id: purposeId
                });
                // 注文取引検索
                // const placeOrderTransactions = await transactionRepo.search<cinerino.factory.transactionType.PlaceOrder>({
                //     limit: 1,
                //     project: { id: { $eq: req.project.id } },
                //     typeOf: cinerino.factory.transactionType.PlaceOrder,
                //     statuses: [cinerino.factory.transactionStatusType.Confirmed],
                //     result: {
                //         order: {
                //             orderNumbers: [orderNumber],
                //             ...{
                //                 confirmationNumber: { $eq: confirmationNumber }
                //             }
                //         }
                //     }
                // });
                // placeOrderTransaction = placeOrderTransactions.shift();
                if (((_e = placeOrderTransaction.result) === null || _e === void 0 ? void 0 : _e.order.orderNumber) !== orderNumber
                    || ((_f = placeOrderTransaction.result) === null || _f === void 0 ? void 0 : _f.order.confirmationNumber) !== confirmationNumber) {
                    throw new cinerino.factory.errors.NotFound('Transaction', 'No transactions matched');
                }
            }
            if (placeOrderTransaction === undefined) {
                throw new cinerino.factory.errors.NotFound('Transaction');
            }
            const transactionResult = placeOrderTransaction.result;
            const orderActionAttributes = {
                agent: req.agent,
                object: transactionResult.order,
                potentialActions: {},
                project: placeOrderTransaction.project,
                purpose: { typeOf: placeOrderTransaction.typeOf, id: placeOrderTransaction.id },
                typeOf: cinerino.factory.actionType.OrderAction
            };
            yield cinerino.service.order.placeOrder(orderActionAttributes)({
                action: actionRepo,
                task: taskRepo,
                transaction: transactionRepo
            });
        }
        res.json({});
    }
    catch (error) {
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
        .withMessage(() => 'theaterCode required'),
    express_validator_1.body('confirmationNumber')
        .not()
        .isEmpty()
        .withMessage(() => 'confirmationNumber required'),
    express_validator_1.body('telephone')
        .not()
        .isEmpty()
        .withMessage(() => 'telephone required')
], validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const phoneUtil = google_libphonenumber_1.PhoneNumberUtil.getInstance();
        const phoneNumber = phoneUtil.parse(req.body.telephone, 'JP');
        if (!phoneUtil.isValidNumber(phoneNumber)) {
            throw new cinerino.factory.errors.Argument('telephone', 'Invalid phone number format');
        }
        const key = {
            theaterCode: req.body.theaterCode,
            reservationNumber: req.body.confirmationNumber,
            telephone: phoneUtil.format(phoneNumber, google_libphonenumber_1.PhoneNumberFormat.E164)
        };
        const orderService = new cinerino.chevre.service.Order({
            endpoint: cinerino.credentials.chevre.endpoint,
            auth: chevreAuthClient
        });
        // 劇場枝番号、予約番号、個人情報完全一致で検索する
        const searchOrdersResult = yield orderService.search({
            limit: 100,
            sort: { orderDate: cinerino.factory.sortType.Descending },
            project: { id: { $eq: req.project.id } },
            // customer: { telephone: `^${escapeRegExp(key.telephone)}$` },
            customer: { telephone: { $eq: key.telephone } },
            acceptedOffers: {
                itemOffered: {
                    reservationFor: { superEvent: { location: { branchCodes: [String(key.theaterCode)] } } },
                    reservationNumbers: [String(key.reservationNumber)]
                }
            }
        });
        if (searchOrdersResult.data.length < 1) {
            // まだ注文が作成されていなければ、注文取引から検索するか検討中だが、いまのところ取引検索条件が足りない...
            throw new cinerino.factory.errors.NotFound('Order');
        }
        res.json(searchOrdersResult.data);
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
        .withMessage(() => 'required'),
    express_validator_1.oneOf([
        // confirmationNumberと、以下どれか1つ、の組み合わせで照会可能
        [
            express_validator_1.body('customer.email')
                .not()
                .isEmpty()
                .isString()
        ],
        [
            express_validator_1.body('customer.telephone')
                .not()
                .isEmpty()
                .isString()
        ],
        [
            express_validator_1.body('orderNumber')
                .not()
                .isEmpty()
                .isString()
        ]
    ])
], validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _g, _h;
    try {
        const email = (_g = req.body.customer) === null || _g === void 0 ? void 0 : _g.email;
        const telephone = (_h = req.body.customer) === null || _h === void 0 ? void 0 : _h.telephone;
        const orderNumber = req.body.orderNumber;
        // 個人情報完全一致で検索する
        const orderService = new cinerino.chevre.service.Order({
            endpoint: cinerino.credentials.chevre.endpoint,
            auth: chevreAuthClient
        });
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
        const searchOrdersResult = yield orderService.search({
            limit: 100,
            sort: { orderDate: cinerino.factory.sortType.Descending },
            project: { id: { $eq: req.project.id } },
            confirmationNumbers: [req.body.confirmationNumber],
            customer: {
                // email: (typeof email === 'string')
                //     ? `^${escapeRegExp(email)}$`
                //     : undefined,
                // telephone: (typeof telephone === 'string')
                //     ? `^${escapeRegExp(telephone)}$`
                //     : undefined,
                email: (typeof email === 'string') ? { $eq: email } : undefined,
                telephone: (typeof telephone === 'string') ? { $eq: telephone } : undefined
            },
            orderNumbers: (typeof orderNumber === 'string') ? [orderNumber] : undefined,
            orderDateFrom: orderDateFrom,
            orderDateThrough: orderDateThrough
        });
        if (searchOrdersResult.data.length < 1) {
            // まだ注文が作成されていなければ、注文取引から検索するか検討中だが、いまのところ取引検索条件が足りない...
            throw new cinerino.factory.errors.NotFound('Order');
        }
        res.json(searchOrdersResult.data);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * 注文番号と何かしらで注文照会
 */
ordersRouter.post('/findOneByOrderNumberAndSomething', permitScopes_1.default(['orders.*', 'orders.read', 'orders.findByConfirmationNumber']), rateLimit_1.default, ...[
    express_validator_1.body('orderNumber')
        .not()
        .isEmpty()
        .isString(),
    express_validator_1.body('customer.telephone')
        .not()
        .isEmpty()
        .isString()
], validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _j;
    try {
        const telephone = (_j = req.body.customer) === null || _j === void 0 ? void 0 : _j.telephone;
        const orderNumber = req.body.orderNumber;
        // 個人情報完全一致で検索する
        const orderService = new cinerino.chevre.service.Order({
            endpoint: cinerino.credentials.chevre.endpoint,
            auth: chevreAuthClient
        });
        const searchOrdersResult = yield orderService.search({
            limit: 1,
            project: { id: { $eq: req.project.id } },
            customer: { telephone: { $eq: telephone } },
            orderNumbers: [orderNumber]
        });
        const order = searchOrdersResult.data.shift();
        if (order === undefined) {
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
        const orderService = new cinerino.chevre.service.Order({
            endpoint: cinerino.credentials.chevre.endpoint,
            auth: chevreAuthClient
        });
        const order = yield orderService.findByOrderNumber({
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
// tslint:disable-next-line:use-default-type-parameter
ordersRouter.post('/:orderNumber/deliver', permitScopes_1.default(['orders.*', 'orders.deliver']), rateLimit_1.default, ...[
    express_validator_1.body('object.confirmationNumber')
        .if(isNotAdmin)
        .not()
        .isEmpty()
        .withMessage(() => 'required')
], validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _k;
    try {
        const actionRepo = new cinerino.repository.Action(mongoose.connection);
        const ownershipInfoRepo = new cinerino.repository.OwnershipInfo(mongoose.connection);
        const taskRepo = new cinerino.repository.Task(mongoose.connection);
        const transactionRepo = new cinerino.repository.Transaction(mongoose.connection);
        const registerActionInProgressRepo = new cinerino.repository.action.RegisterServiceInProgress(redis.getClient());
        const orderNumber = req.params.orderNumber;
        // 注文検索
        const orderService = new cinerino.chevre.service.Order({
            endpoint: cinerino.credentials.chevre.endpoint,
            auth: chevreAuthClient
        });
        const order = yield orderService.findByOrderNumber({
            orderNumber: orderNumber
        });
        if (req.isAdmin) {
            // no op
        }
        else {
            // 確認番号を検証
            const confirmationNumber = (_k = req.body.object) === null || _k === void 0 ? void 0 : _k.confirmationNumber;
            if (order.confirmationNumber !== confirmationNumber) {
                throw new cinerino.factory.errors.NotFound('Order');
            }
        }
        if (order.orderStatus === cinerino.factory.orderStatus.OrderProcessing) {
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
                ownershipInfo: ownershipInfoRepo,
                registerActionInProgress: registerActionInProgressRepo,
                task: taskRepo,
                transaction: transactionRepo
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
/**
 * 確認番号で注文に対してコードを発行する
 */
// tslint:disable-next-line:use-default-type-parameter
ordersRouter.post('/:orderNumber/authorize', permitScopes_1.default(['orders.*', 'orders.read', 'orders.findByConfirmationNumber']), rateLimit_1.default, ...[
    express_validator_1.oneOf([
        [
            express_validator_1.body('object.customer.email')
                .not()
                .isEmpty()
                .isString()
        ],
        [
            express_validator_1.body('object.customer.telephone')
                .not()
                .isEmpty()
                .isString()
        ]
    ]),
    express_validator_1.body('result.expiresInSeconds')
        .optional()
        .isInt({ min: 0, max: CODE_EXPIRES_IN_SECONDS_MAXIMUM })
        .toInt()
], validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _l, _m, _o, _p, _q;
    try {
        const now = new Date();
        const expiresInSeconds = (typeof ((_l = req.body.result) === null || _l === void 0 ? void 0 : _l.expiresInSeconds) === 'number')
            ? Number(req.body.result.expiresInSeconds)
            : CODE_EXPIRES_IN_SECONDS_DEFAULT;
        const email = (_o = (_m = req.body.object) === null || _m === void 0 ? void 0 : _m.customer) === null || _o === void 0 ? void 0 : _o.email;
        const telephone = (_q = (_p = req.body.object) === null || _p === void 0 ? void 0 : _p.customer) === null || _q === void 0 ? void 0 : _q.telephone;
        const actionRepo = new cinerino.repository.Action(mongoose.connection);
        const orderService = new cinerino.chevre.service.Order({
            endpoint: cinerino.credentials.chevre.endpoint,
            auth: chevreAuthClient
        });
        const order = yield orderService.findByOrderNumber({ orderNumber: req.params.orderNumber });
        if (order.customer.email !== email && order.customer.telephone !== telephone) {
            throw new cinerino.factory.errors.NotFound('Order', 'No orders matched');
        }
        // const authorizationObject: cinerino.factory.order.ISimpleOrder = {
        //     project: order.project,
        //     typeOf: order.typeOf,
        //     seller: order.seller,
        //     customer: order.customer,
        //     confirmationNumber: order.confirmationNumber,
        //     orderNumber: order.orderNumber,
        //     price: order.price,
        //     priceCurrency: order.priceCurrency,
        //     orderDate: moment(order.orderDate)
        //         .toDate()
        // };
        // 注文に対してコード発行
        const authorizations = yield cinerino.service.code.publish({
            project: req.project,
            agent: req.agent,
            recipient: req.agent,
            object: [order],
            purpose: {},
            validFrom: now,
            expiresInSeconds: expiresInSeconds
        })({
            action: actionRepo
        });
        // 予約番号でChevreチェックイン
        const reservationService = new cinerino.chevre.service.Reservation({
            endpoint: cinerino.credentials.chevre.endpoint,
            auth: chevreAuthClient
        });
        let reservationNumbers = order.acceptedOffers
            .filter((o) => o.itemOffered.typeOf === cinerino.factory.chevre.reservationType.EventReservation)
            .map((o) => o.itemOffered.reservationNumber);
        reservationNumbers = [...new Set(reservationNumbers)];
        yield Promise.all(reservationNumbers.map((reservationNumber) => __awaiter(void 0, void 0, void 0, function* () {
            yield reservationService.checkInScreeningEventReservations({
                reservationNumber: reservationNumber
            });
        })));
        res.json({
            code: authorizations[0].code
        });
    }
    catch (error) {
        next(error);
    }
}));
exports.default = ordersRouter;
