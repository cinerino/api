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
 * me(今ログイン中のユーザー)ルーター
 * Cinemasunshinに互換性を維持するためのルーター
 * 可能な部分から順次placeOrderTransactionsRouterへ移行していくことが望ましい
 */
const cinerino = require("@cinerino/domain");
const createDebug = require("debug");
const express_1 = require("express");
const google_libphonenumber_1 = require("google-libphonenumber");
const http_status_1 = require("http-status");
const moment = require("moment");
const mongoose = require("mongoose");
const util = require("util");
const permitScopes_1 = require("../../middlewares/permitScopes");
const validator_1 = require("../../middlewares/validator");
const redis = require("../../../redis");
const me4cinemasunshineRouter = express_1.Router();
const debug = createDebug('cinerino-api:router');
const cognitoIdentityServiceProvider = new cinerino.AWS.CognitoIdentityServiceProvider({
    apiVersion: 'latest',
    region: 'ap-northeast-1',
    credentials: new cinerino.AWS.Credentials({
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    })
});
const pecorinoAuthClient = new cinerino.pecorinoapi.auth.ClientCredentials({
    domain: process.env.PECORINO_AUTHORIZE_SERVER_DOMAIN,
    clientId: process.env.PECORINO_CLIENT_ID,
    clientSecret: process.env.PECORINO_CLIENT_SECRET,
    scopes: [],
    state: ''
});
/**
 * 連絡先検索
 * @deprecated
 */
me4cinemasunshineRouter.get('/contacts', permitScopes_1.default(['customer', 'people.contacts', 'people.contacts.read-only']), (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const personRepo = new cinerino.repository.Person(cognitoIdentityServiceProvider);
        const contact = yield personRepo.getUserAttributesByAccessToken(req.accessToken);
        // format a phone number to a Japanese style
        const phoneUtil = google_libphonenumber_1.PhoneNumberUtil.getInstance();
        const phoneNumber = phoneUtil.parse(contact.telephone, 'JP');
        contact.telephone = phoneUtil.format(phoneNumber, google_libphonenumber_1.PhoneNumberFormat.NATIONAL);
        res.json(contact);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * 会員プロフィール更新
 * @deprecated
 */
me4cinemasunshineRouter.put('/contacts', permitScopes_1.default(['customer', 'people.contacts']), validator_1.default, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        // 日本語フォーマットで電話番号が渡される想定なので変換
        let formatedPhoneNumber;
        try {
            const phoneUtil = google_libphonenumber_1.PhoneNumberUtil.getInstance();
            const phoneNumber = phoneUtil.parse(req.body.telephone, 'JP');
            if (!phoneUtil.isValidNumber(phoneNumber)) {
                throw new Error('Invalid phone number format.');
            }
            formatedPhoneNumber = phoneUtil.format(phoneNumber, google_libphonenumber_1.PhoneNumberFormat.E164);
        }
        catch (error) {
            next(new cinerino.factory.errors.Argument('telephone', 'invalid phone number format'));
            return;
        }
        const personRepo = new cinerino.repository.Person(cognitoIdentityServiceProvider);
        yield personRepo.updateProfileByAccessToken({
            accessToken: req.accessToken,
            profile: Object.assign({}, req.body, { telephone: formatedPhoneNumber })
        });
        res.status(http_status_1.NO_CONTENT)
            .end();
    }
    catch (error) {
        next(error);
    }
}));
/**
 * 会員クレジットカード検索
 * @deprecated Use /people/me/ownershipInfos/creditCards
 */
me4cinemasunshineRouter.get('/creditCards', permitScopes_1.default(['customer', 'people.creditCards', 'people.creditCards.read-only']), (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const projectRepo = new cinerino.repository.Project(mongoose.connection);
        const project = yield projectRepo.findById({ id: req.project.id });
        if (project.settings === undefined) {
            throw new cinerino.factory.errors.ServiceUnavailable('Project settings undefined');
        }
        if (project.settings.gmo === undefined) {
            throw new cinerino.factory.errors.ServiceUnavailable('Project settings not found');
        }
        const creditCardRepo = new cinerino.repository.paymentMethod.CreditCard({
            siteId: project.settings.gmo.siteId,
            sitePass: project.settings.gmo.sitePass,
            cardService: new cinerino.GMO.service.Card({ endpoint: project.settings.gmo.endpoint })
        });
        const searchCardResults = yield creditCardRepo.search({ personId: req.user.username });
        debug('searchCardResults:', searchCardResults);
        res.json(searchCardResults);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * 会員クレジットカード追加
 * @deprecated Use /people/me/ownershipInfos/creditCards
 */
me4cinemasunshineRouter.post('/creditCards', permitScopes_1.default(['customer', 'people.creditCards']), validator_1.default, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const projectRepo = new cinerino.repository.Project(mongoose.connection);
        const project = yield projectRepo.findById({ id: req.project.id });
        if (project.settings === undefined) {
            throw new cinerino.factory.errors.ServiceUnavailable('Project settings undefined');
        }
        if (project.settings.gmo === undefined) {
            throw new cinerino.factory.errors.ServiceUnavailable('Project settings not found');
        }
        const creditCardRepo = new cinerino.repository.paymentMethod.CreditCard({
            siteId: project.settings.gmo.siteId,
            sitePass: project.settings.gmo.sitePass,
            cardService: new cinerino.GMO.service.Card({ endpoint: project.settings.gmo.endpoint })
        });
        const creditCard = yield creditCardRepo.save({
            personId: req.user.username,
            creditCard: req.body
        });
        res.status(http_status_1.CREATED)
            .json(creditCard);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * 会員クレジットカード削除
 * @deprecated Use /people/me/ownershipInfos/creditCards/:cardSeq
 */
me4cinemasunshineRouter.delete('/creditCards/:cardSeq', permitScopes_1.default(['customer', 'people.creditCards']), validator_1.default, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const projectRepo = new cinerino.repository.Project(mongoose.connection);
        const project = yield projectRepo.findById({ id: req.project.id });
        if (project.settings === undefined) {
            throw new cinerino.factory.errors.ServiceUnavailable('Project settings undefined');
        }
        if (project.settings.gmo === undefined) {
            throw new cinerino.factory.errors.ServiceUnavailable('Project settings not found');
        }
        const creditCardRepo = new cinerino.repository.paymentMethod.CreditCard({
            siteId: project.settings.gmo.siteId,
            sitePass: project.settings.gmo.sitePass,
            cardService: new cinerino.GMO.service.Card({ endpoint: project.settings.gmo.endpoint })
        });
        yield creditCardRepo.remove({
            personId: req.user.username,
            cardSeq: req.params.cardSeq
        });
        res.status(http_status_1.NO_CONTENT)
            .end();
    }
    catch (error) {
        next(error);
    }
}));
/**
 * ポイント口座開設
 */
me4cinemasunshineRouter.post('/accounts', permitScopes_1.default(['customer', 'people.accounts']), (req, _, next) => {
    req.checkBody('name', 'invalid name')
        .notEmpty()
        .withMessage('name is required');
    next();
}, validator_1.default, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const now = new Date();
        const accountNumberRepo = new cinerino.repository.AccountNumber(redis.getClient());
        const projectRepo = new cinerino.repository.Project(mongoose.connection);
        const account = yield cinerino.service.account.openWithoutOwnershipInfo({
            project: req.project,
            name: req.body.name,
            accountType: cinerino.factory.accountType.Point
        })({
            accountNumber: accountNumberRepo,
            project: projectRepo
        });
        const ownershipInfoRepo = new cinerino.repository.OwnershipInfo(mongoose.connection);
        const identifier = util.format('%s-%s-%s-%s', req.user.sub, cinerino.factory.pecorino.account.TypeOf.Account, account.accountType, account.accountNumber);
        // tslint:disable-next-line:max-line-length
        const ownershipInfo = {
            id: '',
            typeOf: 'OwnershipInfo',
            // 十分にユニーク
            identifier: identifier,
            typeOfGood: {
                typeOf: cinerino.factory.ownershipInfo.AccountGoodType.Account,
                accountType: account.accountType,
                accountNumber: account.accountNumber
            },
            ownedBy: req.agent,
            ownedFrom: now,
            ownedThrough: moment(now)
                // tslint:disable-next-line:no-magic-numbers
                .add(100, 'years')
                .toDate() // 十分に無期限
        };
        yield ownershipInfoRepo.saveByIdentifier(ownershipInfo);
        res.status(http_status_1.CREATED)
            .json(account);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * ポイント口座解約
 * 口座の状態を変更するだけで、所有口座リストから削除はしない
 */
me4cinemasunshineRouter.put('/accounts/:accountNumber/close', permitScopes_1.default(['customer', 'people.accounts']), validator_1.default, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        // 口座所有権を検索
        const ownershipInfoRepo = new cinerino.repository.OwnershipInfo(mongoose.connection);
        const accountOwnershipInfos = yield ownershipInfoRepo.search({
            typeOfGood: {
                typeOf: cinerino.factory.ownershipInfo.AccountGoodType.Account,
                accountType: cinerino.factory.accountType.Point
            },
            ownedBy: {
                id: req.user.sub
            }
        });
        const accountOwnershipInfo = accountOwnershipInfos.find((o) => o.typeOfGood.accountNumber === req.params.accountNumber);
        if (accountOwnershipInfo === undefined) {
            throw new cinerino.factory.errors.NotFound('Account');
        }
        const projectRepo = new cinerino.repository.Project(mongoose.connection);
        const project = yield projectRepo.findById({ id: req.project.id });
        if (project.settings === undefined) {
            throw new cinerino.factory.errors.ServiceUnavailable('Project settings undefined');
        }
        if (project.settings.pecorino === undefined) {
            throw new cinerino.factory.errors.ServiceUnavailable('Project settings not found');
        }
        const accountService = new cinerino.pecorinoapi.service.Account({
            endpoint: project.settings.pecorino.endpoint,
            auth: pecorinoAuthClient
        });
        yield accountService.close({
            accountType: cinerino.factory.accountType.Point,
            accountNumber: accountOwnershipInfo.typeOfGood.accountNumber
        });
        res.status(http_status_1.NO_CONTENT)
            .end();
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
me4cinemasunshineRouter.delete('/accounts/:accountNumber', permitScopes_1.default(['customer', 'people.accounts']), validator_1.default, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const now = new Date();
        // 口座所有権を検索
        const ownershipInfoRepo = new cinerino.repository.OwnershipInfo(mongoose.connection);
        const accountOwnershipInfos = yield ownershipInfoRepo.search({
            typeOfGood: {
                typeOf: cinerino.factory.ownershipInfo.AccountGoodType.Account,
                accountType: cinerino.factory.accountType.Point
            },
            ownedBy: {
                id: req.user.sub
            },
            ownedFrom: now,
            ownedThrough: now
        });
        const accountOwnershipInfo = accountOwnershipInfos.find((o) => o.typeOfGood.accountNumber === req.params.accountNumber);
        if (accountOwnershipInfo === undefined) {
            throw new cinerino.factory.errors.NotFound('Account');
        }
        // 所有期限を更新
        yield ownershipInfoRepo.ownershipInfoModel.findOneAndUpdate({ identifier: accountOwnershipInfo.identifier }, { ownedThrough: now })
            .exec();
        res.status(http_status_1.NO_CONTENT)
            .end();
    }
    catch (error) {
        next(error);
    }
}));
/**
 * ポイント口座検索
 */
me4cinemasunshineRouter.get('/accounts', permitScopes_1.default(['customer', 'people.accounts.read-only']), validator_1.default, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const now = new Date();
        // 口座所有権を検索
        const ownershipInfoRepo = new cinerino.repository.OwnershipInfo(mongoose.connection);
        const accountOwnershipInfos = yield ownershipInfoRepo.search({
            typeOfGood: {
                typeOf: cinerino.factory.ownershipInfo.AccountGoodType.Account,
                accountType: cinerino.factory.accountType.Point
            },
            ownedBy: {
                id: req.user.sub
            },
            ownedFrom: now,
            ownedThrough: now
        });
        let accounts = [];
        if (accountOwnershipInfos.length > 0) {
            const projectRepo = new cinerino.repository.Project(mongoose.connection);
            const project = yield projectRepo.findById({ id: req.project.id });
            if (project.settings === undefined) {
                throw new cinerino.factory.errors.ServiceUnavailable('Project settings undefined');
            }
            if (project.settings.pecorino === undefined) {
                throw new cinerino.factory.errors.ServiceUnavailable('Project settings not found');
            }
            const accountService = new cinerino.pecorinoapi.service.Account({
                endpoint: project.settings.pecorino.endpoint,
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
 * ポイント口座取引履歴検索
 */
me4cinemasunshineRouter.get('/accounts/:accountNumber/actions/moneyTransfer', permitScopes_1.default(['customer', 'people.accounts.actions.read-only']), validator_1.default, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const now = new Date();
        // 口座所有権を検索
        const ownershipInfoRepo = new cinerino.repository.OwnershipInfo(mongoose.connection);
        const accountOwnershipInfos = yield ownershipInfoRepo.search({
            typeOfGood: {
                typeOf: cinerino.factory.ownershipInfo.AccountGoodType.Account,
                accountType: cinerino.factory.accountType.Point
            },
            ownedBy: {
                id: req.user.sub
            },
            ownedFrom: now,
            ownedThrough: now
        });
        const accountOwnershipInfo = accountOwnershipInfos.find((o) => o.typeOfGood.accountNumber === req.params.accountNumber);
        if (accountOwnershipInfo === undefined) {
            throw new cinerino.factory.errors.NotFound('Account');
        }
        const projectRepo = new cinerino.repository.Project(mongoose.connection);
        const project = yield projectRepo.findById({ id: req.project.id });
        if (project.settings === undefined) {
            throw new cinerino.factory.errors.ServiceUnavailable('Project settings undefined');
        }
        if (project.settings.pecorino === undefined) {
            throw new cinerino.factory.errors.ServiceUnavailable('Project settings not found');
        }
        const accountService = new cinerino.pecorinoapi.service.Account({
            endpoint: project.settings.pecorino.endpoint,
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
/**
 * ユーザーの所有権検索
 */
me4cinemasunshineRouter.get('/ownershipInfos/:goodType', permitScopes_1.default(['customer', 'people.ownershipInfos', 'people.ownershipInfos.read-only']), (_1, _2, next) => {
    next();
}, validator_1.default, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const now = new Date();
        const repository = new cinerino.repository.OwnershipInfo(mongoose.connection);
        const ownershipInfos = yield repository.search({
            typeOfGood: {
                typeOf: req.params.goodType
            },
            ownedBy: {
                id: req.user.sub
            },
            ownedFrom: now,
            ownedThrough: now
        });
        res.json(ownershipInfos);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * 会員プログラム登録
 */
me4cinemasunshineRouter.put('/ownershipInfos/programMembership/register', permitScopes_1.default(['customer', 'people.ownershipInfos']), (_1, _2, next) => {
    next();
}, validator_1.default, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const task = yield cinerino.service.programMembership.createRegisterTask({
            agent: req.agent,
            seller: {
                typeOf: req.body.sellerType,
                id: req.body.sellerId
            },
            programMembershipId: req.body.programMembershipId,
            offerIdentifier: req.body.offerIdentifier
        })({
            seller: new cinerino.repository.Seller(mongoose.connection),
            programMembership: new cinerino.repository.ProgramMembership(mongoose.connection),
            task: new cinerino.repository.Task(mongoose.connection)
        });
        // 会員登録タスクとして受け入れられたのでACCEPTED
        res.status(http_status_1.ACCEPTED)
            .json(task);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * 会員プログラム登録解除
 * 所有権のidentifierをURLで指定
 */
me4cinemasunshineRouter.put('/ownershipInfos/programMembership/:identifier/unRegister', permitScopes_1.default(['customer', 'people.ownershipInfos']), (_1, _2, next) => {
    next();
}, validator_1.default, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const task = yield cinerino.service.programMembership.createUnRegisterTask({
            agent: req.agent,
            ownershipInfoIdentifier: req.params.identifier
        })({
            ownershipInfo: new cinerino.repository.OwnershipInfo(mongoose.connection),
            task: new cinerino.repository.Task(mongoose.connection)
        });
        // 会員登録解除タスクとして受け入れられたのでACCEPTED
        res.status(http_status_1.ACCEPTED)
            .json(task);
    }
    catch (error) {
        next(error);
    }
}));
exports.default = me4cinemasunshineRouter;
