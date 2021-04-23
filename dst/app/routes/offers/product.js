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
 * プロダクトオファールーター
 */
const cinerino = require("@cinerino/domain");
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const http_status_1 = require("http-status");
const mongoose = require("mongoose");
const redis = require("../../../redis");
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
const productOffersRouter = express_1.Router();
// アクセスコートは4桁の数字で固定
const accessCodeMustBe = /^[0-9]{4}$/;
// tslint:disable-next-line:use-default-type-parameter
productOffersRouter.post('/authorize', permitScopes_1.default(['transactions']), rateLimit_1.default, (req, _, next) => {
    // objectが配列でない場合は強制変換
    if (!Array.isArray(req.body.object)) {
        req.body.object = [req.body.object];
    }
    next();
}, ...[
    express_validator_1.body('object.*.id')
        .not()
        .isEmpty()
        .withMessage(() => 'required'),
    express_validator_1.body('object.*.itemOffered.id')
        .not()
        .isEmpty()
        .withMessage(() => 'required'),
    express_validator_1.body('object.*.itemOffered.serviceOutput.accessCode')
        .not()
        .isEmpty()
        .withMessage(() => 'required')
        .isString()
        .custom((value) => {
        if (!accessCodeMustBe.test(value)) {
            throw new Error('accessCode must be 4 digits of number');
        }
        return true;
    }),
    express_validator_1.body('object.*.itemOffered.serviceOutput.additionalProperty')
        .optional()
        .isArray({ max: 10 }),
    express_validator_1.body('object.*.itemOffered.serviceOutput.additionalProperty.*.name')
        .optional()
        .not()
        .isEmpty()
        .isString()
        .isLength({ max: ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH }),
    express_validator_1.body('object.*.itemOffered.serviceOutput.additionalProperty.*.value')
        .optional()
        .not()
        .isEmpty()
        .isString()
        .isLength({ max: ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH }),
    express_validator_1.body('purpose')
        .not()
        .isEmpty()
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
        const ownershipInfoService = new cinerino.chevre.service.OwnershipInfo({
            endpoint: cinerino.credentials.chevre.endpoint,
            auth: chevreAuthClient
        });
        const actionObject = req.body.object.map((o) => {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
            return {
                project: req.project,
                typeOf: cinerino.factory.chevre.offerType.Offer,
                id: o === null || o === void 0 ? void 0 : o.id,
                priceCurrency: cinerino.factory.chevre.priceCurrency.JPY,
                itemOffered: Object.assign(Object.assign({}, o === null || o === void 0 ? void 0 : o.itemOffered), { project: req.project, typeOf: (_a = o === null || o === void 0 ? void 0 : o.itemOffered) === null || _a === void 0 ? void 0 : _a.typeOf, id: (_b = o === null || o === void 0 ? void 0 : o.itemOffered) === null || _b === void 0 ? void 0 : _b.id, serviceOutput: Object.assign({ project: req.project, typeOf: (_d = (_c = o === null || o === void 0 ? void 0 : o.itemOffered) === null || _c === void 0 ? void 0 : _c.serviceOutput) === null || _d === void 0 ? void 0 : _d.typeOf, accessCode: (_f = (_e = o === null || o === void 0 ? void 0 : o.itemOffered) === null || _e === void 0 ? void 0 : _e.serviceOutput) === null || _f === void 0 ? void 0 : _f.accessCode, name: (_h = (_g = o === null || o === void 0 ? void 0 : o.itemOffered) === null || _g === void 0 ? void 0 : _g.serviceOutput) === null || _h === void 0 ? void 0 : _h.name }, (Array.isArray((_k = (_j = o === null || o === void 0 ? void 0 : o.itemOffered) === null || _j === void 0 ? void 0 : _j.serviceOutput) === null || _k === void 0 ? void 0 : _k.additionalProperty))
                        ? { additionalProperty: o.itemOffered.serviceOutput.additionalProperty }
                        : undefined) }),
                seller: {} // この指定は実質無視される
                // additionalProperty: (Array.isArray(req.body.object.additionalProperty))
                //     ? (<any[]>req.body.object.additionalProperty).map((p: any) => {
                //         return { name: String(p.name), value: String(p.value) };
                //     })
                //     : [],
            };
        });
        const action = yield cinerino.service.offer.product.authorize({
            project: req.project,
            object: actionObject,
            agent: { id: req.user.sub },
            transaction: { typeOf: req.body.purpose.typeOf, id: req.body.purpose.id }
        })({
            action: new cinerino.repository.Action(mongoose.connection),
            orderNumber: new cinerino.repository.OrderNumber(redis.getClient()),
            ownershipInfo: ownershipInfoService,
            project: new cinerino.repository.Project(mongoose.connection),
            registerActionInProgress: new cinerino.repository.action.RegisterServiceInProgress(redis.getClient()),
            transaction: new cinerino.repository.Transaction(mongoose.connection)
        });
        res.status(http_status_1.CREATED)
            .json(action);
    }
    catch (error) {
        next(error);
    }
}));
// tslint:disable-next-line:use-default-type-parameter
productOffersRouter.put('/authorize/:actionId/void', permitScopes_1.default(['transactions']), rateLimit_1.default, ...[
    express_validator_1.body('purpose')
        .not()
        .isEmpty()
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
        yield cinerino.service.offer.product.voidTransaction({
            id: req.params.actionId,
            agent: { id: req.user.sub },
            project: req.project,
            purpose: { typeOf: req.body.purpose.typeOf, id: req.body.purpose.id }
        })({
            action: new cinerino.repository.Action(mongoose.connection),
            project: new cinerino.repository.Project(mongoose.connection),
            registerActionInProgress: new cinerino.repository.action.RegisterServiceInProgress(redis.getClient()),
            transaction: new cinerino.repository.Transaction(mongoose.connection)
        });
        res.status(http_status_1.NO_CONTENT)
            .end();
    }
    catch (error) {
        next(error);
    }
}));
exports.default = productOffersRouter;
