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
 * 口座決済ルーター
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
const iam_1 = require("../../iam");
const ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH = (process.env.ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH !== undefined)
    ? Number(process.env.ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH)
    // tslint:disable-next-line:no-magic-numbers
    : 256;
const accountPaymentRouter = express_1.Router();
/**
 * 口座確保
 */
// tslint:disable-next-line:use-default-type-parameter
accountPaymentRouter.post('/authorize', permitScopes_1.default([iam_1.Permission.User, 'transactions']), rateLimit_1.default, ...[
    express_validator_1.body('object')
        .not()
        .isEmpty(),
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
    try {
        let fromAccount = req.body.object.fromAccount;
        let toAccount = req.body.object.toAccount;
        // トークン化された口座情報でリクエストされた場合、実口座情報へ変換する
        if (typeof fromAccount === 'string') {
            const accountOwnershipInfo = yield cinerino.service.code.verifyToken({
                project: req.project,
                agent: req.agent,
                token: fromAccount,
                secret: process.env.TOKEN_SECRET,
                issuer: process.env.RESOURCE_SERVER_IDENTIFIER
            })({ action: new cinerino.repository.Action(mongoose.connection) });
            const account = accountOwnershipInfo.typeOfGood;
            if (account.accountType !== cinerino.factory.accountType.Coin) {
                throw new cinerino.factory.errors.Argument('fromAccount', 'Invalid token');
            }
            fromAccount = account;
        }
        else {
            // 口座情報がトークンでない、かつ、APIユーザーが管理者でない場合、許可されるリクエストかどうか確認
            if (!req.isAdmin) {
                if (fromAccount === undefined) {
                    // 入金処理は禁止
                    throw new cinerino.factory.errors.ArgumentNull('From Account');
                }
                else {
                    // 口座に所有権があるかどうか確認
                    const ownershipInfoRepo = new cinerino.repository.OwnershipInfo(mongoose.connection);
                    const count = yield ownershipInfoRepo.count({
                        limit: 1,
                        ownedBy: { id: req.user.sub },
                        ownedFrom: new Date(),
                        ownedThrough: new Date(),
                        typeOfGood: {
                            typeOf: cinerino.factory.ownershipInfo.AccountGoodType.Account,
                            accountType: fromAccount.accountType,
                            accountNumber: fromAccount.accountNumber
                        }
                    });
                    if (count === 0) {
                        throw new cinerino.factory.errors.Forbidden('From Account access forbidden');
                    }
                }
            }
        }
        const accountType = (fromAccount !== undefined)
            ? fromAccount.accountType
            : (toAccount !== undefined) ? toAccount.accountType : undefined;
        const actionRepo = new cinerino.repository.Action(mongoose.connection);
        const projectRepo = new cinerino.repository.Project(mongoose.connection);
        const sellerRepo = new cinerino.repository.Seller(mongoose.connection);
        const transactionRepo = new cinerino.repository.Transaction(mongoose.connection);
        // 注文取引、かつ、toAccount未指定の場合、販売者の口座を検索して、toAccountにセット
        if (toAccount === undefined) {
            const transaction = yield transactionRepo.findById({
                typeOf: req.body.purpose.typeOf,
                id: req.body.purpose.id
            });
            if (transaction.typeOf === cinerino.factory.transactionType.PlaceOrder) {
                const seller = yield sellerRepo.findById({
                    id: transaction.seller.id
                });
                if (seller.paymentAccepted === undefined) {
                    throw new cinerino.factory.errors.Argument('object', 'Account payment not accepted');
                }
                const accountPaymentsAccepted = seller.paymentAccepted.filter((a) => a.paymentMethodType === cinerino.factory.paymentMethodType.Account);
                const paymentAccepted = accountPaymentsAccepted.find((a) => a.accountType === accountType);
                // tslint:disable-next-line:no-single-line-block-comment
                /* istanbul ignore if */
                if (paymentAccepted === undefined) {
                    throw new cinerino.factory.errors.Argument('object', `${accountType} payment not accepted`);
                }
                toAccount = {
                    accountNumber: paymentAccepted.accountNumber,
                    accountType: paymentAccepted.accountType
                };
            }
        }
        const currency = (accountType === cinerino.factory.accountType.Coin)
            ? cinerino.factory.priceCurrency.JPY
            : accountType;
        const action = yield cinerino.service.payment.account.authorize({
            project: req.project,
            object: Object.assign(Object.assign(Object.assign(Object.assign({ typeOf: cinerino.factory.paymentMethodType.Account, amount: Number(req.body.object.amount), currency: currency, additionalProperty: (Array.isArray(req.body.object.additionalProperty))
                    ? req.body.object.additionalProperty.map((p) => {
                        return { name: String(p.name), value: String(p.value) };
                    })
                    : [] }, (typeof req.body.object.name === 'string') ? { name: req.body.object.name } : undefined), (typeof req.body.object.notes === 'string') ? { notes: req.body.object.notes } : undefined), (fromAccount !== undefined) ? { fromAccount } : {}), (toAccount !== undefined) ? { toAccount } : {}),
            agent: { id: req.user.sub },
            purpose: { typeOf: req.body.purpose.typeOf, id: req.body.purpose.id }
        })({
            action: actionRepo,
            project: projectRepo,
            transaction: transactionRepo
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
accountPaymentRouter.put('/authorize/:actionId/void', permitScopes_1.default([iam_1.Permission.User, 'transactions']), rateLimit_1.default, validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
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
        yield cinerino.service.payment.account.voidTransaction({
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
exports.default = accountPaymentRouter;
