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
 * オファールーター
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
const monetaryAmountOffersRouter = express_1.Router();
if (process.env.USE_MONEY_TRANSFER === '1') {
    // tslint:disable-next-line:use-default-type-parameter
    monetaryAmountOffersRouter.post('/authorize', permitScopes_1.default(['transactions']), rateLimit_1.default, ...[
        express_validator_1.body('object')
            .not()
            .isEmpty(),
        express_validator_1.body('object.itemOffered')
            .not()
            .isEmpty(),
        express_validator_1.body('object.itemOffered.value')
            .not()
            .isEmpty()
            .withMessage(() => 'required')
            .isInt()
            .toInt(),
        express_validator_1.body('object.toLocation')
            .not()
            .isEmpty()
            .withMessage(() => 'required'),
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
            const action = yield cinerino.service.offer.monetaryAmount.authorize({
                project: req.project,
                object: {
                    project: req.project,
                    typeOf: cinerino.factory.chevre.offerType.Offer,
                    itemOffered: {
                        typeOf: 'MonetaryAmount',
                        value: Number(req.body.object.itemOffered.value),
                        currency: req.body.object.toLocation.accountType
                    },
                    seller: {},
                    priceCurrency: cinerino.factory.priceCurrency.JPY,
                    // typeOf: cinerino.factory.actionType.MoneyTransfer,
                    // amount: Number(req.body.object.amount),
                    toLocation: req.body.object.toLocation
                    // additionalProperty: (Array.isArray(req.body.object.additionalProperty))
                    //     ? (<any[]>req.body.object.additionalProperty).map((p: any) => {
                    //         return { name: String(p.name), value: String(p.value) };
                    //     })
                    //     : [],
                },
                agent: { id: req.user.sub },
                purpose: { typeOf: req.body.purpose.typeOf, id: req.body.purpose.id }
            })({
                action: new cinerino.repository.Action(mongoose.connection),
                project: new cinerino.repository.Project(mongoose.connection),
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
}
// tslint:disable-next-line:use-default-type-parameter
monetaryAmountOffersRouter.put('/authorize/:actionId/void', permitScopes_1.default(['transactions']), rateLimit_1.default, ...[
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
        yield cinerino.service.offer.monetaryAmount.voidTransaction({
            project: req.project,
            id: req.params.actionId,
            agent: { id: req.user.sub },
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
exports.default = monetaryAmountOffersRouter;
