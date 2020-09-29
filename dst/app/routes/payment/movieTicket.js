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
exports.getMvtKReserveEndpoint = void 0;
/**
 * ムビチケ決済ルーター
 */
const cinerino = require("@cinerino/domain");
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const http_status_1 = require("http-status");
const mongoose = require("mongoose");
const lockTransaction_1 = require("../../middlewares/lockTransaction");
const permitScopes_1 = require("../../middlewares/permitScopes");
const rateLimit_1 = require("../../middlewares/rateLimit");
const rateLimit4transactionInProgress_1 = require("../../middlewares/rateLimit4transactionInProgress");
const validator_1 = require("../../middlewares/validator");
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
function getMvtKReserveEndpoint(params) {
    var _a, _b, _c;
    return __awaiter(this, void 0, void 0, function* () {
        // Chevreからサービスエンドポイントを取得する
        const projectService = new cinerino.chevre.service.Project({
            endpoint: cinerino.credentials.chevre.endpoint,
            auth: chevreAuthClient
        });
        const chevreProject = yield projectService.findById({ id: params.project.id });
        const paymentServiceSetting = (_b = (_a = chevreProject.settings) === null || _a === void 0 ? void 0 : _a.paymentServices) === null || _b === void 0 ? void 0 : _b.find((s) => {
            var _a;
            return s.typeOf === cinerino.chevre.factory.service.paymentService.PaymentServiceType.MovieTicket
                && ((_a = s.serviceOutput) === null || _a === void 0 ? void 0 : _a.typeOf) === params.paymentMethodType;
        });
        if (paymentServiceSetting === undefined) {
            throw new cinerino.factory.errors.NotFound('PaymentService');
        }
        const paymentServiceUrl = (_c = paymentServiceSetting.availableChannel) === null || _c === void 0 ? void 0 : _c.serviceUrl;
        if (typeof paymentServiceUrl !== 'string') {
            throw new cinerino.factory.errors.NotFound('paymentService.availableChannel.serviceUrl');
        }
        return paymentServiceUrl;
    });
}
exports.getMvtKReserveEndpoint = getMvtKReserveEndpoint;
const movieTicketPaymentRouter = express_1.Router();
/**
 * ムビチケ購入番号確認
 */
movieTicketPaymentRouter.post('/actions/check', permitScopes_1.default(['transactions']), rateLimit_1.default, validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    try {
        let paymentMethodType = req.body.typeOf;
        if (typeof paymentMethodType !== 'string') {
            paymentMethodType = cinerino.factory.paymentMethodType.MovieTicket;
        }
        const payService = new cinerino.chevre.service.transaction.Pay({
            endpoint: cinerino.credentials.chevre.endpoint,
            auth: chevreAuthClient
        });
        const checkAction = yield payService.check({
            project: { id: req.project.id, typeOf: cinerino.chevre.factory.organizationType.Project },
            typeOf: cinerino.chevre.factory.actionType.CheckAction,
            agent: req.agent,
            object: [{
                    typeOf: cinerino.chevre.factory.service.paymentService.PaymentServiceType.MovieTicket,
                    paymentMethod: {
                        typeOf: paymentMethodType,
                        additionalProperty: [],
                        name: paymentMethodType,
                        paymentMethodId: '' // 使用されないので空でよし
                    },
                    movieTickets: (Array.isArray(req.body.movieTickets))
                        ? req.body.movieTickets.map((m) => {
                            return Object.assign(Object.assign({}, m), { typeOf: paymentMethodType });
                        })
                        : [],
                    seller: req.body.seller
                }]
        });
        const action = {
            id: checkAction.id,
            project: { id: req.project.id, typeOf: req.project.typeOf },
            typeOf: cinerino.factory.actionType.CheckAction,
            agent: req.agent,
            object: {
                typeOf: paymentMethodType,
                movieTickets: (Array.isArray((_a = checkAction.object[0]) === null || _a === void 0 ? void 0 : _a.movieTickets)) ? (_b = checkAction.object[0]) === null || _b === void 0 ? void 0 : _b.movieTickets : [],
                seller: (_c = checkAction.object[0]) === null || _c === void 0 ? void 0 : _c.seller
            },
            actionStatus: checkAction.actionStatus,
            startDate: checkAction.startDate,
            endDate: checkAction.endDate,
            result: checkAction.result
        };
        res.status(http_status_1.CREATED)
            .json(action);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * ムビチケ決済承認
 */
// tslint:disable-next-line:use-default-type-parameter
movieTicketPaymentRouter.post('/authorize', permitScopes_1.default(['transactions']), rateLimit_1.default, ...[
    express_validator_1.body('object')
        .not()
        .isEmpty(),
    express_validator_1.body('object.typeOf')
        .not()
        .isEmpty()
        .withMessage((_, __) => 'required'),
    express_validator_1.body('object.amount')
        .not()
        .isEmpty()
        .withMessage((_, __) => 'required')
        .isInt(),
    express_validator_1.body('object.additionalProperty')
        .optional()
        .isArray({ max: 10 }),
    express_validator_1.body('object.additionalProperty.*.name')
        .optional()
        .not()
        .isEmpty()
        .isString()
        .isLength({ max: ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH }),
    express_validator_1.body('object.additionalProperty.*.value')
        .optional()
        .not()
        .isEmpty()
        .isString()
        .isLength({ max: ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH }),
    express_validator_1.body('object.movieTickets')
        .not()
        .isEmpty()
        .withMessage((_, __) => 'required')
        .isArray({ max: 20 })
], validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    yield rateLimit4transactionInProgress_1.default({
        typeOf: req.body.purpose.typeOf,
        id: req.body.purpose.id
    })(req, res, next);
}), (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    yield lockTransaction_1.default({
        typeOf: req.body.purpose.typeOf,
        id: req.body.purpose.id
    })(req, res, next);
}), (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _d;
    try {
        let paymentMethodType = (_d = req.body.object) === null || _d === void 0 ? void 0 : _d.paymentMethod;
        if (typeof paymentMethodType !== 'string') {
            paymentMethodType = cinerino.factory.paymentMethodType.MovieTicket;
        }
        const action = yield cinerino.service.payment.chevre.authorize({
            project: req.project,
            agent: { id: req.user.sub },
            object: Object.assign({ 
                // typeOf: paymentMethodType,
                typeOf: cinerino.factory.action.authorize.paymentMethod.any.ResultType.Payment, paymentMethod: paymentMethodType, amount: 0, additionalProperty: (Array.isArray(req.body.object.additionalProperty))
                    ? req.body.object.additionalProperty.map((p) => {
                        return { name: String(p.name), value: String(p.value) };
                    })
                    : [], movieTickets: req.body.object.movieTickets.map((o) => {
                    return Object.assign(Object.assign({}, o), { typeOf: paymentMethodType });
                }) }, (typeof req.body.object.name === 'string') ? { name: req.body.object.name } : undefined),
            purpose: { typeOf: req.body.purpose.typeOf, id: req.body.purpose.id },
            paymentServiceType: cinerino.factory.chevre.service.paymentService.PaymentServiceType.MovieTicket
        })({
            action: new cinerino.repository.Action(mongoose.connection),
            transaction: new cinerino.repository.Transaction(mongoose.connection)
        });
        res.status(http_status_1.CREATED)
            .json(action);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * ムビチケ決済承認取消
 */
movieTicketPaymentRouter.put('/authorize/:actionId/void', permitScopes_1.default(['transactions']), rateLimit_1.default, validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    yield rateLimit4transactionInProgress_1.default({
        typeOf: req.body.purpose.typeOf,
        id: req.body.purpose.id
    })(req, res, next);
}), (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    yield lockTransaction_1.default({
        typeOf: req.body.purpose.typeOf,
        id: req.body.purpose.id
    })(req, res, next);
}), (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield cinerino.service.payment.chevre.voidPayment({
            project: { id: req.project.id, typeOf: req.project.typeOf },
            agent: { id: req.user.sub },
            id: req.params.actionId,
            purpose: { typeOf: req.body.purpose.typeOf, id: req.body.purpose.id }
        })({
            action: new cinerino.repository.Action(mongoose.connection),
            transaction: new cinerino.repository.Transaction(mongoose.connection)
        });
        res.status(http_status_1.NO_CONTENT)
            .end();
    }
    catch (error) {
        next(error);
    }
}));
exports.default = movieTicketPaymentRouter;
