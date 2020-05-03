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
 * プリペイドカードルーター
 */
const cinerino = require("@cinerino/domain");
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const http_status_1 = require("http-status");
const moment = require("moment-timezone");
const mongoose = require("mongoose");
const redis = require("../../../redis");
const permitScopes_1 = require("../../middlewares/permitScopes");
const rateLimit_1 = require("../../middlewares/rateLimit");
const validator_1 = require("../../middlewares/validator");
const prepaidCardPaymentMethodsRouter = express_1.Router();
/**
 * プリペイドカード作成
 */
prepaidCardPaymentMethodsRouter.post('', permitScopes_1.default(['paymentMethods.PrepaidCard.*', 'paymentMethods.PrepaidCard.create']), rateLimit_1.default, ...[
    express_validator_1.body('name')
        .not()
        .isEmpty()
        .isString(),
    express_validator_1.body('accessCode')
        .not()
        .isEmpty()
        .isString()
], validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // 口座作成
        const account = yield cinerino.service.account.openWithoutOwnershipInfo({
            project: { typeOf: req.project.typeOf, id: req.project.id },
            accountType: cinerino.factory.accountType.Prepaid,
            name: req.body.name
        })({
            accountNumber: new cinerino.repository.AccountNumber(redis.getClient()),
            project: new cinerino.repository.Project(mongoose.connection)
        });
        // アクセスコードを作成
        const accessCode = req.body.accessCode;
        // プリペイドカード作成
        const paymentMethodRepo = new cinerino.repository.PaymentMethod(mongoose.connection);
        const prepaidCard = {
            project: { typeOf: req.project.typeOf, id: req.project.id },
            typeOf: cinerino.factory.paymentMethodType.PrepaidCard,
            identifier: account.accountNumber,
            accessCode: accessCode,
            amount: {
                typeOf: 'MonetaryAmount',
                currency: cinerino.factory.priceCurrency.JPY,
                validFrom: moment(account.openDate)
                    .toDate()
            },
            name: account.name
        };
        const doc = yield paymentMethodRepo.paymentMethodModel.create(prepaidCard);
        res.status(http_status_1.CREATED)
            .json(doc.toObject());
    }
    catch (error) {
        next(error);
    }
}));
/**
 * プリペイドカード検索
 */
prepaidCardPaymentMethodsRouter.get('', permitScopes_1.default(['paymentMethods.*', 'paymentMethods.read']), rateLimit_1.default, ...[
    express_validator_1.query('limit')
        .optional()
        .isInt()
        .toInt(),
    express_validator_1.query('page')
        .optional()
        .isInt()
        .toInt()
], validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const paymentMethodRepo = new cinerino.repository.PaymentMethod(mongoose.connection);
        const searchConditions = Object.assign(Object.assign({}, req.query), { project: { ids: [req.project.id] }, 
            // tslint:disable-next-line:no-magic-numbers
            limit: (req.query.limit !== undefined) ? Math.min(req.query.limit, 100) : 100, page: (req.query.page !== undefined) ? Math.max(req.query.page, 1) : 1, typeOf: { $eq: cinerino.factory.paymentMethodType.PrepaidCard } });
        const paymentMethods = yield paymentMethodRepo.search(searchConditions);
        res.json(paymentMethods);
    }
    catch (error) {
        next(error);
    }
}));
exports.default = prepaidCardPaymentMethodsRouter;
