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
// tslint:disable-next-line:no-submodule-imports
const check_1 = require("express-validator/check");
const http_status_1 = require("http-status");
const mongoose = require("mongoose");
const authentication_1 = require("../../middlewares/authentication");
const lockTransaction_1 = require("../../middlewares/lockTransaction");
const permitScopes_1 = require("../../middlewares/permitScopes");
const rateLimit4transactionInProgress_1 = require("../../middlewares/rateLimit4transactionInProgress");
const validator_1 = require("../../middlewares/validator");
/**
 * GMOメンバーIDにユーザーネームを使用するかどうか
 */
const USE_USERNAME_AS_GMO_MEMBER_ID = process.env.USE_USERNAME_AS_GMO_MEMBER_ID === '1';
const creditCardPaymentRouter = express_1.Router();
creditCardPaymentRouter.use(authentication_1.default);
/**
 * クレジットカード決済承認
 */
creditCardPaymentRouter.post('/authorize', permitScopes_1.default(['admin', 'customer', 'transactions']), ...[
    check_1.body('object')
        .not()
        .isEmpty(),
    check_1.body('object.typeOf')
        .not()
        .isEmpty()
        .withMessage((_, __) => 'required'),
    check_1.body('object.amount')
        .not()
        .isEmpty()
        .withMessage((_, __) => 'required')
        .isInt(),
    check_1.body('object.additionalProperty')
        .optional()
        .isArray(),
    check_1.body('object.orderId')
        .optional()
        .isString()
        .withMessage((_, options) => `${options.path} must be string`)
        .isLength({ max: 27 }),
    check_1.body('object.method')
        .not()
        .isEmpty()
        .withMessage((_, __) => 'required'),
    check_1.body('object.creditCard')
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
    try {
        const memberId = (USE_USERNAME_AS_GMO_MEMBER_ID) ? req.user.username : req.user.sub;
        const creditCard = Object.assign(Object.assign({}, req.body.object.creditCard), { memberId: memberId });
        const action = yield cinerino.service.payment.creditCard.authorize({
            project: req.project,
            agent: { id: req.user.sub },
            object: Object.assign(Object.assign({ typeOf: cinerino.factory.paymentMethodType.CreditCard, additionalProperty: (Array.isArray(req.body.object.additionalProperty))
                    ? req.body.object.additionalProperty.map((p) => {
                        return { name: String(p.name), value: String(p.value) };
                    })
                    : [], amount: req.body.object.amount, method: req.body.object.method, creditCard: creditCard }, (typeof req.body.object.name === 'string') ? { name: req.body.object.name } : undefined), (typeof req.body.object.orderId === 'string') ? { orderId: req.body.object.orderId } : undefined),
            purpose: { typeOf: req.body.purpose.typeOf, id: req.body.purpose.id }
        })({
            action: new cinerino.repository.Action(mongoose.connection),
            project: new cinerino.repository.Project(mongoose.connection),
            transaction: new cinerino.repository.Transaction(mongoose.connection),
            seller: new cinerino.repository.Seller(mongoose.connection)
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
creditCardPaymentRouter.put('/authorize/:actionId/void', permitScopes_1.default(['admin', 'customer', 'transactions']), validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
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
        yield cinerino.service.payment.creditCard.voidTransaction({
            project: { id: req.project.id },
            agent: { id: req.user.sub },
            id: req.params.actionId,
            purpose: { typeOf: req.body.purpose.typeOf, id: req.body.purpose.id }
        })({
            action: new cinerino.repository.Action(mongoose.connection),
            project: new cinerino.repository.Project(mongoose.connection),
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
