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
 * クレジットカード決済ルーター
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
const chevreAuthClient = new cinerino.chevre.auth.ClientCredentials({
    domain: process.env.CHEVRE_AUTHORIZE_SERVER_DOMAIN,
    clientId: process.env.CHEVRE_CLIENT_ID,
    clientSecret: process.env.CHEVRE_CLIENT_SECRET,
    scopes: [],
    state: ''
});
const ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH = (process.env.ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH !== undefined)
    ? Number(process.env.ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH)
    // tslint:disable-next-line:no-magic-numbers
    : 256;
const creditCardPaymentRouter = express_1.Router();
/**
 * クレジットカード決済承認
 */
// tslint:disable-next-line:use-default-type-parameter
creditCardPaymentRouter.post('/authorize', permitScopes_1.default(['transactions']), rateLimit_1.default, ...[
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
    express_validator_1.body('object.orderId')
        .optional()
        .isString()
        .withMessage((_, options) => `${options.path} must be string`)
        .isLength({ max: 27 }),
    express_validator_1.body('object.method')
        .not()
        .isEmpty()
        .withMessage((_, __) => 'required'),
    express_validator_1.body('object.creditCard')
        .not()
        .isEmpty()
        .withMessage((_, __) => 'required')
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
    var _a;
    try {
        const projectRepo = new cinerino.repository.Project(mongoose.connection);
        const project = yield projectRepo.findById({ id: req.project.id });
        const useUsernameAsGMOMemberId = ((_a = project.settings) === null || _a === void 0 ? void 0 : _a.useUsernameAsGMOMemberId) === true;
        const memberId = (useUsernameAsGMOMemberId) ? req.user.username : req.user.sub;
        const creditCard = Object.assign(Object.assign({}, req.body.object.creditCard), { memberId: memberId });
        const action = yield cinerino.service.payment.chevre.authorize({
            project: req.project,
            agent: { id: req.user.sub },
            object: Object.assign(Object.assign({ typeOf: cinerino.factory.action.authorize.paymentMethod.any.ResultType.Payment, paymentMethod: cinerino.factory.paymentMethodType.CreditCard, additionalProperty: (Array.isArray(req.body.object.additionalProperty))
                    ? req.body.object.additionalProperty.map((p) => {
                        return { name: String(p.name), value: String(p.value) };
                    })
                    : [], amount: req.body.object.amount, method: req.body.object.method, creditCard: creditCard }, (typeof req.body.object.name === 'string') ? { name: req.body.object.name } : undefined), (typeof req.body.object.orderId === 'string') ? { orderId: req.body.object.orderId } : undefined),
            purpose: { typeOf: req.body.purpose.typeOf, id: req.body.purpose.id },
            paymentServiceType: cinerino.factory.chevre.service.paymentService.PaymentServiceType.CreditCard
        })({
            action: new cinerino.repository.Action(mongoose.connection),
            transaction: new cinerino.repository.Transaction(mongoose.connection),
            transactionNumber: new cinerino.chevre.service.TransactionNumber({
                endpoint: cinerino.credentials.chevre.endpoint,
                auth: req.chevreAuthClient,
                project: { id: req.project.id }
            })
        });
        res.status(http_status_1.CREATED)
            .json(Object.assign(Object.assign({}, action), { result: undefined }));
    }
    catch (error) {
        next(error);
    }
}));
/**
 * クレジットカード決済承認取消
 */
creditCardPaymentRouter.put('/authorize/:actionId/void', permitScopes_1.default(['transactions']), rateLimit_1.default, validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
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
            assetTransaction: new cinerino.chevre.service.AssetTransaction({
                endpoint: cinerino.credentials.chevre.endpoint,
                auth: chevreAuthClient,
                project: { id: req.project.id }
            }),
            transaction: new cinerino.repository.Transaction(mongoose.connection)
        });
        res.status(http_status_1.NO_CONTENT)
            .end();
    }
    catch (error) {
        next(error);
    }
}));
exports.default = creditCardPaymentRouter;
