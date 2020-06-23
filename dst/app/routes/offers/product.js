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
const productOffersRouter = express_1.Router();
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
        .withMessage(() => 'required'),
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
        const actionObject = req.body.object.map((o) => {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t;
            return {
                project: req.project,
                typeOf: cinerino.factory.chevre.offerType.Offer,
                id: (_a = o) === null || _a === void 0 ? void 0 : _a.id,
                priceCurrency: cinerino.factory.chevre.priceCurrency.JPY,
                itemOffered: Object.assign(Object.assign({}, (_b = o) === null || _b === void 0 ? void 0 : _b.itemOffered), { project: req.project, typeOf: (_d = (_c = o) === null || _c === void 0 ? void 0 : _c.itemOffered) === null || _d === void 0 ? void 0 : _d.typeOf, id: (_f = (_e = o) === null || _e === void 0 ? void 0 : _e.itemOffered) === null || _f === void 0 ? void 0 : _f.id, serviceOutput: Object.assign({ project: req.project, typeOf: (_j = (_h = (_g = o) === null || _g === void 0 ? void 0 : _g.itemOffered) === null || _h === void 0 ? void 0 : _h.serviceOutput) === null || _j === void 0 ? void 0 : _j.typeOf, accessCode: (_m = (_l = (_k = o) === null || _k === void 0 ? void 0 : _k.itemOffered) === null || _l === void 0 ? void 0 : _l.serviceOutput) === null || _m === void 0 ? void 0 : _m.accessCode, name: (_q = (_p = (_o = o) === null || _o === void 0 ? void 0 : _o.itemOffered) === null || _p === void 0 ? void 0 : _p.serviceOutput) === null || _q === void 0 ? void 0 : _q.name }, (Array.isArray((_t = (_s = (_r = o) === null || _r === void 0 ? void 0 : _r.itemOffered) === null || _s === void 0 ? void 0 : _s.serviceOutput) === null || _t === void 0 ? void 0 : _t.additionalProperty))
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
            accountNumber: new cinerino.repository.AccountNumber(redis.getClient()),
            action: new cinerino.repository.Action(mongoose.connection),
            ownershipInfo: new cinerino.repository.OwnershipInfo(mongoose.connection),
            project: new cinerino.repository.Project(mongoose.connection),
            registerActionInProgress: new cinerino.repository.action.RegisterServiceInProgress(redis.getClient()),
            seller: new cinerino.repository.Seller(mongoose.connection),
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
            purpose: { typeOf: req.body.purpose.typeOf, id: req.body.purpose.id }
        })({
            action: new cinerino.repository.Action(mongoose.connection),
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
