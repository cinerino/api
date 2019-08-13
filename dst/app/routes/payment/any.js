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
const lockTransaction_1 = require("../../middlewares/lockTransaction");
const permitScopes_1 = require("../../middlewares/permitScopes");
const rateLimit4transactionInProgress_1 = require("../../middlewares/rateLimit4transactionInProgress");
const validator_1 = require("../../middlewares/validator");
const anyPaymentRouter = express_1.Router();
anyPaymentRouter.use(authentication_1.default);
/**
 * 汎用決済承認
 */
anyPaymentRouter.post('/authorize', permitScopes_1.default(['admin']), ...[
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
        .isArray()
], validator_1.default, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    yield rateLimit4transactionInProgress_1.default({
        typeOf: req.body.purpose.typeOf,
        id: req.body.purpose.id
    })(req, res, next);
}), (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    yield lockTransaction_1.default({
        typeOf: req.body.purpose.typeOf,
        id: req.body.purpose.id
    })(req, res, next);
}), (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const action = yield cinerino.service.payment.any.authorize({
            agent: { id: req.user.sub },
            object: Object.assign({}, req.body.object, { additionalProperty: (Array.isArray(req.body.object.additionalProperty))
                    ? req.body.object.additionalProperty.map((p) => {
                        return { name: String(p.name), value: String(p.value) };
                    })
                    : [] }, (typeof req.body.object.name === 'string') ? { name: req.body.object.name } : undefined),
            purpose: { typeOf: req.body.purpose.typeOf, id: req.body.purpose.id }
        })({
            action: new cinerino.repository.Action(mongoose.connection),
            transaction: new cinerino.repository.Transaction(mongoose.connection),
            seller: new cinerino.repository.Seller(mongoose.connection)
        });
        res.status(http_status_1.CREATED)
            .json(action);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * 汎用決済承認取消
 */
anyPaymentRouter.put('/authorize/:actionId/void', permitScopes_1.default(['admin']), validator_1.default, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    yield rateLimit4transactionInProgress_1.default({
        typeOf: req.body.purpose.typeOf,
        id: req.body.purpose.id
    })(req, res, next);
}), (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    yield lockTransaction_1.default({
        typeOf: req.body.purpose.typeOf,
        id: req.body.purpose.id
    })(req, res, next);
}), (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        yield cinerino.service.payment.any.voidTransaction({
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
exports.default = anyPaymentRouter;
