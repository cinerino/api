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
 * 口座決済ルーター
 */
const cinerino = require("@cinerino/domain");
const express_1 = require("express");
// tslint:disable-next-line:no-submodule-imports
const check_1 = require("express-validator/check");
const http_status_1 = require("http-status");
const mongoose = require("mongoose");
const authentication_1 = require("../../middlewares/authentication");
const permitScopes_1 = require("../../middlewares/permitScopes");
const validator_1 = require("../../middlewares/validator");
const pecorinoAuthClient = new cinerino.pecorinoapi.auth.ClientCredentials({
    domain: process.env.PECORINO_AUTHORIZE_SERVER_DOMAIN,
    clientId: process.env.PECORINO_CLIENT_ID,
    clientSecret: process.env.PECORINO_CLIENT_SECRET,
    scopes: [],
    state: ''
});
const accountPaymentRouter = express_1.Router();
accountPaymentRouter.use(authentication_1.default);
/**
 * 口座確保
 */
accountPaymentRouter.post('/authorize', permitScopes_1.default(['admin', 'aws.cognito.signin.user.admin', 'transactions']), ...[
    check_1.body('object.amount')
        .not()
        .isEmpty()
        .withMessage((_, options) => `${options.path} is required`)
        .isInt(),
    check_1.body('object.additionalProperty')
        .optional()
        .isArray(),
    check_1.body('object.fromAccount')
        .not()
        .isEmpty()
        .withMessage((_, options) => `${options.path} is required`)
], validator_1.default, 
// rateLimit4transactionInProgress,
(req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        let fromAccount = req.body.object.fromAccount;
        // トークン化された口座情報でリクエストされた場合、実口座情報へ変換する
        if (typeof fromAccount === 'string') {
            const accountOwnershipInfo = yield cinerino.service.code.verifyToken({
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
            // 口座情報がトークンでない、かつ、APIユーザーが管理者でない場合、口座に所有権があるかどうか確認
            if (!req.isAdmin) {
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
        const toAccount = req.body.object.toAccount;
        // pecorino転送取引サービスクライアントを生成
        const transferService = new cinerino.pecorinoapi.service.transaction.Transfer({
            endpoint: process.env.PECORINO_ENDPOINT,
            auth: pecorinoAuthClient
        });
        const withdrawService = new cinerino.pecorinoapi.service.transaction.Withdraw({
            endpoint: process.env.PECORINO_ENDPOINT,
            auth: pecorinoAuthClient
        });
        const action = yield cinerino.service.payment.account.authorize({
            object: {
                typeOf: cinerino.factory.paymentMethodType.Account,
                amount: req.body.object.amount,
                additionalProperty: req.body.object.additionalProperty,
                fromAccount: {
                    accountType: fromAccount.accountType,
                    accountNumber: fromAccount.accountNumber
                },
                toAccount: {
                    accountType: toAccount.accountType,
                    accountNumber: toAccount.accountNumber
                },
                notes: req.body.object.notes
            },
            agent: { id: req.user.sub },
            purpose: { typeOf: req.body.purpose.typeOf, id: req.body.purpose.id }
        })({
            action: new cinerino.repository.Action(mongoose.connection),
            transaction: new cinerino.repository.Transaction(mongoose.connection),
            transferTransactionService: transferService,
            withdrawTransactionService: withdrawService
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
accountPaymentRouter.put('/authorize/:actionId/void', permitScopes_1.default(['admin', 'aws.cognito.signin.user.admin', 'transactions']), validator_1.default, 
// rateLimit4transactionInProgress,
(req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const withdrawService = new cinerino.pecorinoapi.service.transaction.Withdraw({
            endpoint: process.env.PECORINO_ENDPOINT,
            auth: pecorinoAuthClient
        });
        const transferService = new cinerino.pecorinoapi.service.transaction.Transfer({
            endpoint: process.env.PECORINO_ENDPOINT,
            auth: pecorinoAuthClient
        });
        yield cinerino.service.payment.account.voidTransaction({
            id: req.params.actionId,
            agent: { id: req.user.sub },
            purpose: { typeOf: req.body.purpose.typeOf, id: req.body.purpose.id }
        })({
            action: new cinerino.repository.Action(mongoose.connection),
            transaction: new cinerino.repository.Transaction(mongoose.connection),
            transferTransactionService: transferService,
            withdrawTransactionService: withdrawService
        });
        res.status(http_status_1.NO_CONTENT)
            .end();
    }
    catch (error) {
        next(error);
    }
}));
exports.default = accountPaymentRouter;
