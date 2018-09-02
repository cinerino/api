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
 * 自分の口座ルーター
 */
const cinerino = require("@cinerino/domain");
const express_1 = require("express");
const http_status_1 = require("http-status");
const permitScopes_1 = require("../../../../middlewares/permitScopes");
const validator_1 = require("../../../../middlewares/validator");
const redis = require("../../../../../redis");
const accountsRouter = express_1.Router();
const pecorinoAuthClient = new cinerino.pecorinoapi.auth.ClientCredentials({
    domain: process.env.PECORINO_AUTHORIZE_SERVER_DOMAIN,
    clientId: process.env.PECORINO_CLIENT_ID,
    clientSecret: process.env.PECORINO_CLIENT_SECRET,
    scopes: [],
    state: ''
});
/**
 * 口座開設
 */
accountsRouter.post('/:accountType', permitScopes_1.default(['aws.cognito.signin.user.admin']), (req, _, next) => {
    req.checkBody('name', 'invalid name').notEmpty().withMessage('name is required');
    next();
}, validator_1.default, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const ownershipInfoRepo = new cinerino.repository.OwnershipInfo(cinerino.mongoose.connection);
        const accountNumberRepo = new cinerino.repository.AccountNumber(redis.getClient());
        const accountService = new cinerino.pecorinoapi.service.Account({
            endpoint: process.env.PECORINO_ENDPOINT,
            auth: pecorinoAuthClient
        });
        const ownershipInfo = yield cinerino.service.account.open({
            agent: req.agent,
            name: req.body.name,
            accountType: req.params.accountType
        })({
            ownershipInfo: ownershipInfoRepo,
            accountNumber: accountNumberRepo,
            accountService: accountService
        });
        res.status(http_status_1.CREATED).json(ownershipInfo);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * 口座解約
 * 口座の状態を変更するだけで、所有口座リストから削除はしない
 */
accountsRouter.put('/:accountType/:accountNumber/close', permitScopes_1.default(['aws.cognito.signin.user.admin']), validator_1.default, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const ownershipInfoRepo = new cinerino.repository.OwnershipInfo(cinerino.mongoose.connection);
        const accountService = new cinerino.pecorinoapi.service.Account({
            endpoint: process.env.PECORINO_ENDPOINT,
            auth: pecorinoAuthClient
        });
        yield cinerino.service.account.close({
            ownedBy: {
                id: req.user.sub
            },
            accountType: req.params.accountType,
            accountNumber: req.params.accountNumber
        })({
            ownershipInfo: ownershipInfoRepo,
            accountService: accountService
        });
        res.status(http_status_1.NO_CONTENT).end();
    }
    catch (error) {
        next(error);
    }
}));
/**
 * 口座取引履歴検索
 */
accountsRouter.get('/actions/moneyTransfer', permitScopes_1.default(['aws.cognito.signin.user.admin']), validator_1.default, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const ownershipInfoRepo = new cinerino.repository.OwnershipInfo(cinerino.mongoose.connection);
        const accountService = new cinerino.pecorinoapi.service.Account({
            endpoint: process.env.PECORINO_ENDPOINT,
            auth: pecorinoAuthClient
        });
        const actions = yield cinerino.service.account.searchMoneyTransferActions({
            ownedBy: {
                id: req.user.sub
            },
            conditions: req.query
        })({
            ownershipInfo: ownershipInfoRepo,
            accountService: accountService
        });
        res.set('X-Total-Count', actions.length.toString());
        res.json(actions);
    }
    catch (error) {
        next(error);
    }
}));
exports.default = accountsRouter;
