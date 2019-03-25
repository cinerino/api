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
 * ポイント口座ルーター
 */
const cinerino = require("@cinerino/domain");
// import * as createDebug from 'debug';
const express_1 = require("express");
const http_status_1 = require("http-status");
const authentication_1 = require("../middlewares/authentication");
const permitScopes_1 = require("../middlewares/permitScopes");
const validator_1 = require("../middlewares/validator");
const accountsRouter = express_1.Router();
// const debug = createDebug('cinerino-api:routes:accounts');
const pecorinoAuthClient = new cinerino.pecorinoapi.auth.ClientCredentials({
    domain: process.env.PECORINO_AUTHORIZE_SERVER_DOMAIN,
    clientId: process.env.PECORINO_CLIENT_ID,
    clientSecret: process.env.PECORINO_CLIENT_SECRET,
    scopes: [],
    state: ''
});
accountsRouter.use(authentication_1.default);
/**
 * 管理者として口座に入金する
 */
accountsRouter.post('/transactions/deposit', permitScopes_1.default(['admin']), (req, __, next) => {
    req.checkBody('recipient', 'invalid recipient')
        .notEmpty()
        .withMessage('recipient is required');
    req.checkBody('amount', 'invalid amount')
        .notEmpty()
        .withMessage('amount is required')
        .isInt();
    req.checkBody('toAccountNumber', 'invalid toAccountNumber')
        .notEmpty()
        .withMessage('toAccountNumber is required');
    next();
}, validator_1.default, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const depositService = new cinerino.pecorinoapi.service.transaction.Deposit({
            endpoint: process.env.PECORINO_ENDPOINT,
            auth: pecorinoAuthClient
        });
        yield cinerino.service.account.deposit({
            toAccountNumber: req.body.toAccountNumber,
            agent: {
                id: req.user.sub,
                name: (req.user.username !== undefined) ? req.user.username : req.user.sub,
                url: ''
            },
            recipient: req.body.recipient,
            amount: Number(req.body.amount),
            notes: (req.body.notes !== undefined) ? req.body.notes : '入金'
        })({
            depositService: depositService
        });
        res.status(http_status_1.NO_CONTENT)
            .end();
    }
    catch (error) {
        next(error);
    }
}));
exports.default = accountsRouter;
