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
 * プリペイドカード決済ルーター
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
const paymentCardPaymentRouter = express_1.Router();
/**
 * カード照会
 */
paymentCardPaymentRouter.post('/check', permitScopes_1.default(['transactions']), rateLimit_1.default, validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const serviceOutputService = new cinerino.chevre.service.ServiceOutput({
            endpoint: cinerino.credentials.chevre.endpoint,
            auth: chevreAuthClient,
            project: { id: req.project.id }
        });
        const searchPaymentCardResult = yield serviceOutputService.search({
            limit: 1,
            page: 1,
            project: { typeOf: req.project.typeOf, id: req.project.id },
            typeOf: { $eq: req.body.object.typeOf },
            identifier: { $eq: req.body.object.identifier },
            accessCode: { $eq: req.body.object.accessCode }
        });
        if (searchPaymentCardResult.data.length === 0) {
            throw new cinerino.factory.errors.NotFound('PaymentCard');
        }
        const paymetCard = searchPaymentCardResult.data.shift();
        res.json(Object.assign(Object.assign({}, paymetCard), { accessCode: undefined // アクセスコードをマスク
         }));
    }
    catch (error) {
        next(error);
    }
}));
/**
 * 口座確保
 */
// tslint:disable-next-line:use-default-type-parameter
paymentCardPaymentRouter.post('/authorize', permitScopes_1.default(['transactions']), rateLimit_1.default, 
// 互換性維持のため
(req, _, next) => {
    var _a, _b;
    if (req.body.object === undefined || req.body.object === null) {
        req.body.object = {};
    }
    if (typeof req.body.object.notes === 'string') {
        req.body.object.description = req.body.object.notes;
    }
    if (typeof ((_b = (_a = req.body.object) === null || _a === void 0 ? void 0 : _a.fromAccount) === null || _b === void 0 ? void 0 : _b.accountNumber) === 'string') {
        if (req.body.object.fromLocation === undefined || req.body.object.fromLocation === null) {
            req.body.object.fromLocation = {};
        }
        req.body.object.fromLocation.identifier = req.body.object.fromAccount.accountNumber;
    }
    next();
}, ...[
    express_validator_1.body('object.paymentMethod')
        .not()
        .isEmpty()
        .withMessage(() => 'required')
        .isString(),
    express_validator_1.body('object.amount')
        .not()
        .isEmpty()
        .withMessage(() => 'required')
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
        .isLength({ max: ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH })
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
}), 
// tslint:disable-next-line:max-func-body-length
(req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e, _f;
    try {
        const actionRepo = new cinerino.repository.Action(mongoose.connection);
        const transactionRepo = new cinerino.repository.Transaction(mongoose.connection);
        const ownershipInfoService = new cinerino.chevre.service.OwnershipInfo({
            endpoint: cinerino.credentials.chevre.endpoint,
            auth: chevreAuthClient,
            project: { id: req.project.id }
        });
        let paymentCard;
        const paymentMethodType = (_a = req.body.object) === null || _a === void 0 ? void 0 : _a.paymentMethod;
        // トークン化された口座情報でリクエストされた場合、実口座情報へ変換する
        if (typeof ((_b = req.body.object) === null || _b === void 0 ? void 0 : _b.fromLocation) === 'string') {
            const accountOwnershipInfo = yield cinerino.service.code.verifyToken({
                project: req.project,
                agent: req.agent,
                token: req.body.object.fromLocation,
                secret: process.env.TOKEN_SECRET,
                issuer: process.env.RESOURCE_SERVER_IDENTIFIER
            })({ action: new cinerino.repository.Action(mongoose.connection) });
            const typeOfGood = accountOwnershipInfo.typeOfGood;
            paymentCard = {
                typeOf: typeOfGood.typeOf,
                identifier: typeOfGood.identifier
            };
        }
        else {
            const accessCode = (_d = (_c = req.body.object) === null || _c === void 0 ? void 0 : _c.fromLocation) === null || _d === void 0 ? void 0 : _d.accessCode;
            const accountIdentifier = (_f = (_e = req.body.object) === null || _e === void 0 ? void 0 : _e.fromLocation) === null || _f === void 0 ? void 0 : _f.identifier;
            if (typeof accountIdentifier === 'string') {
                if (typeof accessCode === 'string') {
                    // アクセスコード情報があれば、認証
                    const serviceOutputService = new cinerino.chevre.service.ServiceOutput({
                        endpoint: cinerino.credentials.chevre.endpoint,
                        auth: chevreAuthClient,
                        project: { id: req.project.id }
                    });
                    const searchPaymentCardResult = yield serviceOutputService.search({
                        limit: 1,
                        page: 1,
                        project: { typeOf: req.project.typeOf, id: req.project.id },
                        typeOf: { $eq: paymentMethodType },
                        identifier: { $eq: accountIdentifier },
                        accessCode: { $eq: accessCode }
                    });
                    if (searchPaymentCardResult.data.length === 0) {
                        throw new cinerino.factory.errors.NotFound('PaymentCard');
                    }
                    const paymetCard = searchPaymentCardResult.data.shift();
                    paymentCard = {
                        typeOf: paymetCard.typeOf,
                        identifier: paymetCard.identifier
                    };
                }
                else {
                    // アクセスコード情報なし、かつ、会員の場合、所有権を確認
                    if (typeof req.user.username === 'string') {
                        // 口座に所有権があるかどうか確認
                        const searchOwnershipInfosResult = yield ownershipInfoService.search({
                            limit: 1,
                            project: { id: { $eq: req.project.id } },
                            ownedBy: { id: req.user.sub },
                            ownedFrom: new Date(),
                            ownedThrough: new Date(),
                            typeOfGood: {
                                typeOf: paymentMethodType,
                                accountNumber: { $eq: accountIdentifier }
                            }
                        });
                        const paymentCardOwnershipInfos = searchOwnershipInfosResult.data;
                        if (paymentCardOwnershipInfos.length === 0) {
                            throw new cinerino.factory.errors.Forbidden('From Account access forbidden');
                        }
                        paymentCard = { typeOf: paymentMethodType, identifier: accountIdentifier };
                    }
                }
            }
        }
        if (paymentCard === undefined) {
            throw new cinerino.factory.errors.ArgumentNull('From Location');
        }
        const action = yield cinerino.service.payment.chevre.authorize({
            project: req.project,
            agent: { id: req.user.sub },
            object: Object.assign(Object.assign({ typeOf: cinerino.factory.action.authorize.paymentMethod.any.ResultType.Payment, paymentMethod: paymentMethodType, additionalProperty: (Array.isArray(req.body.object.additionalProperty))
                    ? req.body.object.additionalProperty.map((p) => {
                        return { name: String(p.name), value: String(p.value) };
                    })
                    : [], amount: Number(req.body.object.amount), accountId: paymentCard.identifier }, (typeof req.body.object.name === 'string') ? { name: req.body.object.name } : undefined), (typeof req.body.object.description === 'string') ? { description: req.body.object.description } : undefined),
            purpose: { typeOf: req.body.purpose.typeOf, id: req.body.purpose.id },
            paymentServiceType: cinerino.factory.chevre.service.paymentService.PaymentServiceType.PaymentCard
        })({
            action: actionRepo,
            transaction: transactionRepo,
            transactionNumber: new cinerino.chevre.service.TransactionNumber({
                endpoint: cinerino.credentials.chevre.endpoint,
                auth: req.chevreAuthClient,
                project: { id: req.project.id }
            })
        });
        res.status(http_status_1.CREATED)
            .json(action);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * 口座承認取消
 */
paymentCardPaymentRouter.put('/authorize/:actionId/void', permitScopes_1.default(['transactions']), rateLimit_1.default, validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
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
exports.default = paymentCardPaymentRouter;
