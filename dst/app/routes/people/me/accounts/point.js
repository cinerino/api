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
 * 自分のポイント口座ルーター
 */
const cinerino = require("@cinerino/domain");
const express_1 = require("express");
const http_status_1 = require("http-status");
const moment = require("moment");
const authentication_1 = require("../../../../middlewares/authentication");
const permitScopes_1 = require("../../../../middlewares/permitScopes");
const requireMember_1 = require("../../../../middlewares/requireMember");
const validator_1 = require("../../../../middlewares/validator");
const redis = require("../../../../../redis");
const pointAccountsRouter = express_1.Router();
const pecorinoAuthClient = new cinerino.pecorinoapi.auth.ClientCredentials({
    domain: process.env.PECORINO_AUTHORIZE_SERVER_DOMAIN,
    clientId: process.env.PECORINO_CLIENT_ID,
    clientSecret: process.env.PECORINO_CLIENT_SECRET,
    scopes: [],
    state: ''
});
pointAccountsRouter.use(authentication_1.default);
pointAccountsRouter.use(requireMember_1.default); // 自分のリソースへのアクセスなので、もちろんログイン必須
/**
 * ポイント口座開設
 */
pointAccountsRouter.post('/', permitScopes_1.default(['aws.cognito.signin.user.admin', 'people.accounts']), (req, _, next) => {
    req.checkBody('name', 'invalid name').notEmpty().withMessage('name is required');
    next();
}, validator_1.default, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const now = new Date();
        const accountNumberRepo = new cinerino.repository.AccountNumber(redis.getClient());
        const accountService = new cinerino.pecorinoapi.service.Account({
            endpoint: process.env.PECORINO_ENDPOINT,
            auth: pecorinoAuthClient
        });
        const account = yield cinerino.service.account.open({
            name: req.body.name
        })({
            accountNumber: accountNumberRepo,
            accountService: accountService
        });
        const ownershipInfoRepo = new cinerino.repository.OwnershipInfo(cinerino.mongoose.connection);
        const ownershipInfo = {
            typeOf: 'OwnershipInfo',
            // 十分にユニーク
            // tslint:disable-next-line:max-line-length
            identifier: `${req.user.sub}-${cinerino.factory.ownershipInfo.AccountGoodType.Account}-${cinerino.factory.accountType.Point}-${account.accountNumber}`,
            typeOfGood: {
                typeOf: cinerino.factory.ownershipInfo.AccountGoodType.Account,
                accountType: cinerino.factory.accountType.Point,
                accountNumber: account.accountNumber
            },
            ownedBy: req.agent,
            ownedFrom: now,
            // tslint:disable-next-line:no-magic-numbers
            ownedThrough: moment(now).add(100, 'years').toDate() // 十分に無期限
        };
        yield ownershipInfoRepo.save(ownershipInfo);
        res.status(http_status_1.CREATED).json(account);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * ポイント口座解約
 * 口座の状態を変更するだけで、所有口座リストから削除はしない
 */
pointAccountsRouter.put('/:accountNumber/close', permitScopes_1.default(['aws.cognito.signin.user.admin', 'people.accounts']), validator_1.default, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        // 口座所有権を検索
        const ownershipInfoRepo = new cinerino.repository.OwnershipInfo(cinerino.mongoose.connection);
        const accountOwnershipInfos = yield ownershipInfoRepo.search({
            goodType: cinerino.factory.ownershipInfo.AccountGoodType.Account,
            ownedBy: req.user.sub
        });
        const accountOwnershipInfo = accountOwnershipInfos.find((o) => o.typeOfGood.accountNumber === req.params.accountNumber);
        if (accountOwnershipInfo === undefined) {
            throw new cinerino.factory.errors.NotFound('Account');
        }
        const accountService = new cinerino.pecorinoapi.service.Account({
            endpoint: process.env.PECORINO_ENDPOINT,
            auth: pecorinoAuthClient
        });
        yield accountService.close({
            accountType: cinerino.factory.accountType.Point,
            accountNumber: accountOwnershipInfo.typeOfGood.accountNumber
        });
        res.status(http_status_1.NO_CONTENT).end();
    }
    catch (error) {
        // PecorinoAPIのレスポンスステータスコードが4xxであればクライアントエラー
        if (error.name === 'PecorinoRequestError') {
            // Pecorino APIのステータスコード4xxをハンドリング
            const message = `${error.name}:${error.message}`;
            switch (error.code) {
                case http_status_1.BAD_REQUEST: // 400
                    error = new cinerino.factory.errors.Argument('accountNumber', message);
                    break;
                case http_status_1.UNAUTHORIZED: // 401
                    error = new cinerino.factory.errors.Unauthorized(message);
                    break;
                case http_status_1.FORBIDDEN: // 403
                    error = new cinerino.factory.errors.Forbidden(message);
                    break;
                case http_status_1.NOT_FOUND: // 404
                    error = new cinerino.factory.errors.NotFound(message);
                    break;
                case http_status_1.TOO_MANY_REQUESTS: // 429
                    error = new cinerino.factory.errors.RateLimitExceeded(message);
                    break;
                default:
                    error = new cinerino.factory.errors.ServiceUnavailable(message);
            }
        }
        next(error);
    }
}));
/**
 * ポイント口座削除
 */
pointAccountsRouter.delete('/:accountNumber', permitScopes_1.default(['aws.cognito.signin.user.admin', 'people.accounts']), validator_1.default, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const now = new Date();
        // 口座所有権を検索
        const ownershipInfoRepo = new cinerino.repository.OwnershipInfo(cinerino.mongoose.connection);
        const accountOwnershipInfos = yield ownershipInfoRepo.search({
            goodType: cinerino.factory.ownershipInfo.AccountGoodType.Account,
            ownedBy: req.user.sub,
            ownedAt: now
        });
        const accountOwnershipInfo = accountOwnershipInfos.find((o) => o.typeOfGood.accountNumber === req.params.accountNumber);
        if (accountOwnershipInfo === undefined) {
            throw new cinerino.factory.errors.NotFound('Account');
        }
        // 所有期限を更新
        yield ownershipInfoRepo.ownershipInfoModel.findOneAndUpdate({ identifier: accountOwnershipInfo.identifier }, { ownedThrough: now }).exec();
        res.status(http_status_1.NO_CONTENT).end();
    }
    catch (error) {
        next(error);
    }
}));
/**
 * ポイント口座検索
 */
pointAccountsRouter.get('', permitScopes_1.default(['aws.cognito.signin.user.admin', 'people.accounts.read-only']), validator_1.default, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const now = new Date();
        // 口座所有権を検索
        const ownershipInfoRepo = new cinerino.repository.OwnershipInfo(cinerino.mongoose.connection);
        const accountOwnershipInfos = yield ownershipInfoRepo.search({
            goodType: cinerino.factory.ownershipInfo.AccountGoodType.Account,
            ownedBy: req.user.sub,
            ownedAt: now
        });
        let accounts = [];
        if (accountOwnershipInfos.length > 0) {
            const accountService = new cinerino.pecorinoapi.service.Account({
                endpoint: process.env.PECORINO_ENDPOINT,
                auth: pecorinoAuthClient
            });
            accounts = yield accountService.search({
                accountType: cinerino.factory.accountType.Point,
                accountNumbers: accountOwnershipInfos.map((o) => o.typeOfGood.accountNumber),
                statuses: [],
                limit: 100
            });
        }
        res.json(accounts);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * ポイント取引履歴検索
 */
pointAccountsRouter.get('/:accountNumber/actions/moneyTransfer', permitScopes_1.default(['aws.cognito.signin.user.admin', 'people.accounts.actions.read-only']), validator_1.default, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const now = new Date();
        // 口座所有権を検索
        const ownershipInfoRepo = new cinerino.repository.OwnershipInfo(cinerino.mongoose.connection);
        const accountOwnershipInfos = yield ownershipInfoRepo.search({
            goodType: cinerino.factory.ownershipInfo.AccountGoodType.Account,
            ownedBy: req.user.sub,
            ownedAt: now
        });
        const accountOwnershipInfo = accountOwnershipInfos.find((o) => o.typeOfGood.accountNumber === req.params.accountNumber);
        if (accountOwnershipInfo === undefined) {
            throw new cinerino.factory.errors.NotFound('Account');
        }
        const accountService = new cinerino.pecorinoapi.service.Account({
            endpoint: process.env.PECORINO_ENDPOINT,
            auth: pecorinoAuthClient
        });
        const actions = yield accountService.searchMoneyTransferActions({
            accountType: cinerino.factory.accountType.Point,
            accountNumber: accountOwnershipInfo.typeOfGood.accountNumber
        });
        res.json(actions);
    }
    catch (error) {
        next(error);
    }
}));
exports.default = pointAccountsRouter;
