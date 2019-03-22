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
 * クレジットカード決済ルーター
 */
const cinerino = require("@cinerino/domain");
const express_1 = require("express");
// tslint:disable-next-line:no-submodule-imports
const check_1 = require("express-validator/check");
const http_status_1 = require("http-status");
const mongoose = require("mongoose");
const authentication_1 = require("../../middlewares/authentication");
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
creditCardPaymentRouter.post('/authorize', permitScopes_1.default(['admin', 'aws.cognito.signin.user.admin', 'transactions']), ...[
    check_1.body('object.typeOf')
        .not()
        .isEmpty()
        .withMessage((_, options) => `${options.path} is required`),
    check_1.body('object.amount')
        .not()
        .isEmpty()
        .withMessage((_, options) => `${options.path} is required`)
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
        .withMessage((_, options) => `${options.path} is required`),
    check_1.body('object.creditCard')
        .not()
        .isEmpty()
        .withMessage((_, options) => `${options.path} is required`)
], validator_1.default, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    yield rateLimit4transactionInProgress_1.default({
        typeOf: req.body.purpose.typeOf,
        id: req.body.purpose.id
    })(req, res, next);
}), (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const memberId = (USE_USERNAME_AS_GMO_MEMBER_ID) ? req.user.username : req.user.sub;
        const creditCard = Object.assign({}, req.body.object.creditCard, { memberId: memberId });
        const action = yield cinerino.service.payment.creditCard.authorize({
            project: {
                id: process.env.PROJECT_ID,
                gmoInfo: {
                    siteId: process.env.GMO_SITE_ID,
                    sitePass: process.env.GMO_SITE_PASS
                }
            },
            agent: { id: req.user.sub },
            object: {
                typeOf: cinerino.factory.paymentMethodType.CreditCard,
                additionalProperty: req.body.object.additionalProperty,
                orderId: req.body.object.orderId,
                amount: req.body.object.amount,
                method: req.body.object.method,
                creditCard: creditCard
            },
            purpose: { typeOf: req.body.purpose.typeOf, id: req.body.purpose.id }
        })({
            action: new cinerino.repository.Action(mongoose.connection),
            transaction: new cinerino.repository.Transaction(mongoose.connection),
            seller: new cinerino.repository.Seller(mongoose.connection)
        });
        if (action.result !== undefined) {
            delete action.result.entryTranArgs;
            delete action.result.entryTranResult;
            delete action.result.execTranArgs;
            delete action.result.execTranResult;
        }
        res.status(http_status_1.CREATED)
            .json(action);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * クレジットカード決済承認取消
 */
creditCardPaymentRouter.put('/authorize/:actionId/void', permitScopes_1.default(['admin', 'aws.cognito.signin.user.admin', 'transactions']), validator_1.default, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    yield rateLimit4transactionInProgress_1.default({
        typeOf: req.body.purpose.typeOf,
        id: req.body.purpose.id
    })(req, res, next);
}), (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        yield cinerino.service.payment.creditCard.voidTransaction({
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
exports.default = creditCardPaymentRouter;
