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
 * 注文取引ルーター
 */
const cinerino = require("@cinerino/domain");
const middlewares = require("@motionpicture/express-middleware");
const createDebug = require("debug");
const express_1 = require("express");
// tslint:disable-next-line:no-submodule-imports
const check_1 = require("express-validator/check");
const google_libphonenumber_1 = require("google-libphonenumber");
const http_status_1 = require("http-status");
const ioredis = require("ioredis");
const moment = require("moment");
const mongoose = require("mongoose");
const authentication_1 = require("../../middlewares/authentication");
const permitScopes_1 = require("../../middlewares/permitScopes");
const validator_1 = require("../../middlewares/validator");
const placeOrder4cinemasunshine_1 = require("./placeOrder4cinemasunshine");
const redis = require("../../../redis");
const WAITER_DISABLED = process.env.WAITER_DISABLED === '1';
const placeOrderTransactionsRouter = express_1.Router();
const debug = createDebug('cinerino-api:router');
const pecorinoAuthClient = new cinerino.pecorinoapi.auth.ClientCredentials({
    domain: process.env.PECORINO_AUTHORIZE_SERVER_DOMAIN,
    clientId: process.env.PECORINO_CLIENT_ID,
    clientSecret: process.env.PECORINO_CLIENT_SECRET,
    scopes: [],
    state: ''
});
const chevreAuthClient = new cinerino.chevre.auth.ClientCredentials({
    domain: process.env.CHEVRE_AUTHORIZE_SERVER_DOMAIN,
    clientId: process.env.CHEVRE_CLIENT_ID,
    clientSecret: process.env.CHEVRE_CLIENT_SECRET,
    scopes: [],
    state: ''
});
const mvtkReserveAuthClient = new cinerino.mvtkreserveapi.auth.ClientCredentials({
    domain: process.env.MVTK_RESERVE_AUTHORIZE_SERVER_DOMAIN,
    clientId: process.env.MVTK_RESERVE_CLIENT_ID,
    clientSecret: process.env.MVTK_RESERVE_CLIENT_SECRET,
    scopes: [],
    state: ''
});
// tslint:disable-next-line:no-magic-numbers
const UNIT_IN_SECONDS = parseInt(process.env.TRANSACTION_RATE_LIMIT_UNIT_IN_SECONDS, 10);
// tslint:disable-next-line:no-magic-numbers
const THRESHOLD = parseInt(process.env.TRANSACTION_RATE_LIMIT_THRESHOLD, 10);
/**
 * 進行中取引の接続回数制限ミドルウェア
 * 取引IDを使用して動的にスコープを作成する
 */
const rateLimit4transactionInProgress = middlewares.rateLimit({
    redisClient: new ioredis({
        host: process.env.REDIS_HOST,
        // tslint:disable-next-line:no-magic-numbers
        port: parseInt(process.env.REDIS_PORT, 10),
        password: process.env.REDIS_KEY,
        tls: (process.env.REDIS_TLS_SERVERNAME !== undefined) ? { servername: process.env.REDIS_TLS_SERVERNAME } : undefined
    }),
    aggregationUnitInSeconds: UNIT_IN_SECONDS,
    threshold: THRESHOLD,
    // 制限超過時の動作をカスタマイズ
    limitExceededHandler: (__0, __1, res, next) => {
        res.setHeader('Retry-After', UNIT_IN_SECONDS);
        const message = `Retry after ${UNIT_IN_SECONDS} seconds for your transaction`;
        next(new cinerino.factory.errors.RateLimitExceeded(message));
    },
    // スコープ生成ロジックをカスタマイズ
    scopeGenerator: (req) => `placeOrderTransaction.${req.params.transactionId}`
});
placeOrderTransactionsRouter.use(authentication_1.default);
// Cinemasunshine対応
placeOrderTransactionsRouter.use(placeOrder4cinemasunshine_1.default);
placeOrderTransactionsRouter.post('/start', permitScopes_1.default(['aws.cognito.signin.user.admin', 'transactions']), 
// Cinemasunshine互換性維持のため
(req, _, next) => {
    if (typeof req.body.sellerId === 'string') {
        req.body.seller = {
            typeOf: cinerino.factory.organizationType.MovieTheater,
            id: req.body.sellerId
        };
    }
    if (typeof req.body.passportToken === 'string') {
        req.body.object = {
            passport: { token: req.body.passportToken }
        };
    }
    next();
}, (req, _, next) => {
    req.checkBody('expires', 'invalid expires')
        .notEmpty()
        .withMessage('expires is required')
        .isISO8601();
    req.checkBody('agent.identifier', 'invalid agent identifier')
        .optional()
        .isArray();
    req.checkBody('seller.typeOf', 'invalid seller type')
        .notEmpty()
        .withMessage('seller.typeOf is required');
    req.checkBody('seller.id', 'invalid seller id')
        .notEmpty()
        .withMessage('seller.id is required');
    if (!WAITER_DISABLED) {
        req.checkBody('object.passport.token', 'invalid passport token')
            .notEmpty()
            .withMessage('object.passport.token is required');
    }
    next();
}, validator_1.default, 
// tslint:disable-next-line:max-func-body-length
(req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        // WAITER有効設定であれば許可証をセット
        let passport;
        if (!WAITER_DISABLED) {
            if (process.env.WAITER_PASSPORT_ISSUER === undefined) {
                throw new cinerino.factory.errors.ServiceUnavailable('WAITER_PASSPORT_ISSUER undefined');
            }
            if (process.env.WAITER_SECRET === undefined) {
                throw new cinerino.factory.errors.ServiceUnavailable('WAITER_SECRET undefined');
            }
            passport = {
                token: req.body.object.passport.token,
                issuer: process.env.WAITER_PASSPORT_ISSUER,
                secret: process.env.WAITER_SECRET
            };
        }
        const sellerRepo = new cinerino.repository.Seller(mongoose.connection);
        const transactionRepo = new cinerino.repository.Transaction(mongoose.connection);
        // パラメーターの形式をunix timestampからISO 8601フォーマットに変更したため、互換性を維持するように期限をセット
        const expires = (/^\d+$/.test(req.body.expires))
            // tslint:disable-next-line:no-magic-numbers
            ? moment.unix(Number(req.body.expires))
                .toDate()
            : moment(req.body.expires)
                .toDate();
        let passportValidator = (params) => {
            // 許可証発行者確認
            const validIssuer = params.passport.iss === process.env.WAITER_PASSPORT_ISSUER;
            // スコープのフォーマットは、Transaction:PlaceOrder:${sellerId}
            const explodedScopeStrings = params.passport.scope.split(':');
            const validScope = (explodedScopeStrings[0] === 'Transaction' && // スコープ接頭辞確認
                explodedScopeStrings[1] === cinerino.factory.transactionType.PlaceOrder && // スコープ接頭辞確認
                // tslint:disable-next-line:no-magic-numbers
                explodedScopeStrings[2] === req.body.seller.id // 販売者識別子確認
            );
            // クライアントの有効性
            let validClient = true;
            if (req.user.client_id !== undefined) {
                if (Array.isArray(params.passport.aud) && params.passport.aud.indexOf(req.user.client_id) < 0) {
                    validClient = false;
                }
            }
            return validIssuer && validScope && validClient;
        };
        // Cinemasunshine対応として
        if (process.env.USE_OLD_PASSPORT_VALIDATOR === '1') {
            const seller = yield sellerRepo.findById({ id: req.body.sellerId });
            passportValidator = (params) => {
                // tslint:disable-next-line:no-single-line-block-comment
                /* istanbul ignore next */
                if (process.env.WAITER_PASSPORT_ISSUER === undefined) {
                    throw new Error('WAITER_PASSPORT_ISSUER unset');
                }
                const issuers = process.env.WAITER_PASSPORT_ISSUER.split(',');
                const validIssuer = issuers.indexOf(params.passport.iss) >= 0;
                // スコープのフォーマットは、placeOrderTransaction.{sellerId}
                const explodedScopeStrings = params.passport.scope.split('.');
                const validScope = (
                // tslint:disable-next-line:no-magic-numbers
                explodedScopeStrings.length === 2 &&
                    explodedScopeStrings[0] === 'placeOrderTransaction' && // スコープ接頭辞確認
                    explodedScopeStrings[1] === seller.identifier // 販売者識別子確認
                );
                return validIssuer && validScope;
            };
        }
        const transaction = yield cinerino.service.transaction.placeOrderInProgress.start({
            expires: expires,
            agent: Object.assign({}, req.agent, { identifier: [
                    ...(req.agent.identifier !== undefined) ? req.agent.identifier : [],
                    ...(req.body.agent !== undefined && req.body.agent.identifier !== undefined) ? req.body.agent.identifier : []
                ] }),
            seller: req.body.seller,
            object: {
                clientUser: req.user,
                passport: passport
            },
            passportValidator: passportValidator
        })({
            seller: sellerRepo,
            transaction: transactionRepo
        });
        // tslint:disable-next-line:no-string-literal
        // const host = req.headers['host'];
        // res.setHeader('Location', `https://${host}/transactions/${transaction.id}`);
        res.json(transaction);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * 購入者情報を変更する
 */
placeOrderTransactionsRouter.put('/:transactionId/customerContact', permitScopes_1.default(['aws.cognito.signin.user.admin', 'transactions']), (req, _, next) => {
    req.checkBody('familyName')
        .notEmpty()
        .withMessage('required');
    req.checkBody('givenName')
        .notEmpty()
        .withMessage('required');
    req.checkBody('telephone')
        .notEmpty()
        .withMessage('required');
    req.checkBody('email')
        .notEmpty()
        .withMessage('required');
    next();
}, validator_1.default, rateLimit4transactionInProgress, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        let formattedTelephone = req.body.telephone;
        // Cinemasunshine対応(SDKで自動的にtelephoneRegion=JPが指定されてくる)
        if (typeof req.body.telephoneRegion === 'string'
            || process.env.CUSTOMER_TELEPHONE_JP_FORMAT_ACCEPTED === '1') {
            try {
                const phoneUtil = google_libphonenumber_1.PhoneNumberUtil.getInstance();
                const phoneNumber = phoneUtil.parse(req.body.telephone, 'JP');
                if (!phoneUtil.isValidNumber(phoneNumber)) {
                    throw new cinerino.factory.errors.Argument('contact.telephone', 'Invalid phone number format.');
                }
                formattedTelephone = phoneUtil.format(phoneNumber, google_libphonenumber_1.PhoneNumberFormat.E164);
            }
            catch (error) {
                throw new cinerino.factory.errors.Argument('contact.telephone', error.message);
            }
        }
        const contact = yield cinerino.service.transaction.placeOrderInProgress.setCustomerContact({
            id: req.params.transactionId,
            agent: { id: req.user.sub },
            object: {
                customerContact: {
                    familyName: req.body.familyName,
                    givenName: req.body.givenName,
                    email: req.body.email,
                    telephone: formattedTelephone
                }
            }
        })({
            transaction: new cinerino.repository.Transaction(mongoose.connection)
        });
        // Cinemasunshine対応
        if (process.env.CUSTOMER_TELEPHONE_JP_FORMAT_ACCEPTED === '1') {
            res.status(http_status_1.CREATED)
                .json(contact);
        }
        else {
            res.json(contact);
        }
    }
    catch (error) {
        next(error);
    }
}));
/**
 * 座席仮予約
 */
placeOrderTransactionsRouter.post('/:transactionId/actions/authorize/offer/seatReservation', permitScopes_1.default(['aws.cognito.signin.user.admin', 'transactions']), (__1, __2, next) => {
    next();
}, validator_1.default, rateLimit4transactionInProgress, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const eventService = new cinerino.chevre.service.Event({
            endpoint: process.env.CHEVRE_ENDPOINT,
            auth: chevreAuthClient
        });
        const reserveService = new cinerino.chevre.service.transaction.Reserve({
            endpoint: process.env.CHEVRE_ENDPOINT,
            auth: chevreAuthClient
        });
        const action = yield cinerino.service.transaction.placeOrderInProgress.action.authorize.offer.seatReservation.create({
            object: req.body,
            agent: { id: req.user.sub },
            transaction: { id: req.params.transactionId }
        })({
            action: new cinerino.repository.Action(mongoose.connection),
            event: new cinerino.repository.Event(mongoose.connection),
            eventService: eventService,
            movieTicket: new cinerino.repository.paymentMethod.MovieTicket({
                endpoint: process.env.MVTK_RESERVE_ENDPOINT,
                auth: mvtkReserveAuthClient
            }),
            seller: new cinerino.repository.Seller(mongoose.connection),
            reserveService: reserveService,
            transaction: new cinerino.repository.Transaction(mongoose.connection)
        });
        res.status(http_status_1.CREATED)
            .json(action);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * 座席仮予約取消
 */
placeOrderTransactionsRouter.put('/:transactionId/actions/authorize/offer/seatReservation/:actionId/cancel', permitScopes_1.default(['aws.cognito.signin.user.admin', 'transactions']), validator_1.default, rateLimit4transactionInProgress, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const reserveService = new cinerino.chevre.service.transaction.Reserve({
            endpoint: process.env.CHEVRE_ENDPOINT,
            auth: chevreAuthClient
        });
        yield cinerino.service.transaction.placeOrderInProgress.action.authorize.offer.seatReservation.cancel({
            agent: { id: req.user.sub },
            transaction: { id: req.params.transactionId },
            id: req.params.actionId
        })({
            action: new cinerino.repository.Action(mongoose.connection),
            transaction: new cinerino.repository.Transaction(mongoose.connection),
            reserveService: reserveService
        });
        res.status(http_status_1.NO_CONTENT)
            .end();
    }
    catch (error) {
        next(error);
    }
}));
/**
 * 汎用決済承認
 */
placeOrderTransactionsRouter.post('/:transactionId/actions/authorize/paymentMethod/any', permitScopes_1.default(['admin']), ...[
    check_1.body('typeOf')
        .not()
        .isEmpty()
        .withMessage((_, options) => `${options.path} is required`),
    check_1.body('amount')
        .not()
        .isEmpty()
        .withMessage((_, options) => `${options.path} is required`)
        .isInt(),
    check_1.body('additionalProperty')
        .optional()
        .isArray()
], validator_1.default, rateLimit4transactionInProgress, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const action = yield cinerino.service.transaction.placeOrderInProgress.action.authorize.paymentMethod.any.create({
            object: req.body,
            agent: { id: req.user.sub },
            transaction: { id: req.params.transactionId }
        })({
            action: new cinerino.repository.Action(mongoose.connection),
            transaction: new cinerino.repository.Transaction(mongoose.connection),
            seller: new cinerino.repository.Seller(mongoose.connection)
        });
        res.status(http_status_1.CREATED)
            .json(action);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * 汎用決済承認取消
 */
placeOrderTransactionsRouter.put('/:transactionId/actions/authorize/paymentMethod/any/:actionId/cancel', permitScopes_1.default(['admin']), validator_1.default, rateLimit4transactionInProgress, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        yield cinerino.service.transaction.placeOrderInProgress.action.authorize.paymentMethod.any.cancel({
            id: req.params.actionId,
            agent: { id: req.user.sub },
            transaction: { id: req.params.transactionId }
        })({
            action: new cinerino.repository.Action(mongoose.connection),
            transaction: new cinerino.repository.Transaction(mongoose.connection)
        });
        res.status(http_status_1.NO_CONTENT)
            .end();
    }
    catch (error) {
        next(error);
    }
}));
/**
 * クレジットカードオーソリ
 */
placeOrderTransactionsRouter.post('/:transactionId/actions/authorize/paymentMethod/creditCard', permitScopes_1.default(['aws.cognito.signin.user.admin', 'transactions']), ...[
    check_1.body('typeOf')
        .not()
        .isEmpty()
        .withMessage((_, options) => `${options.path} is required`),
    check_1.body('amount')
        .not()
        .isEmpty()
        .withMessage((_, options) => `${options.path} is required`)
        .isInt(),
    check_1.body('additionalProperty')
        .optional()
        .isArray(),
    check_1.body('orderId')
        .not()
        .isEmpty()
        .withMessage((_, options) => `${options.path} is required`)
        .isString()
        .withMessage((_, options) => `${options.path} must be string`)
        .isLength({ max: 27 }),
    check_1.body('method')
        .not()
        .isEmpty()
        .withMessage((_, options) => `${options.path} is required`),
    check_1.body('creditCard')
        .not()
        .isEmpty()
        .withMessage((_, options) => `${options.path} is required`)
], validator_1.default, rateLimit4transactionInProgress, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const creditCard = Object.assign({}, req.body.creditCard, { memberId: req.user.sub });
        debug('authorizing credit card...', creditCard);
        debug('authorizing credit card...', req.body.creditCard);
        const action = yield cinerino.service.transaction.placeOrderInProgress.action.authorize.paymentMethod.creditCard.create({
            object: {
                typeOf: cinerino.factory.paymentMethodType.CreditCard,
                additionalProperty: req.body.additionalProperty,
                orderId: req.body.orderId,
                amount: req.body.amount,
                method: req.body.method,
                creditCard: creditCard
            },
            agent: { id: req.user.sub },
            transaction: { id: req.params.transactionId }
        })({
            action: new cinerino.repository.Action(mongoose.connection),
            transaction: new cinerino.repository.Transaction(mongoose.connection),
            seller: new cinerino.repository.Seller(mongoose.connection)
        });
        if (action.result !== undefined) {
            delete action.result.entryTranArgs;
            delete action.result.execTranArgs;
            delete action.result.execTranResult;
        }
        res.status(http_status_1.CREATED)
            .json(action);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * クレジットカードオーソリ取消
 */
placeOrderTransactionsRouter.put('/:transactionId/actions/authorize/paymentMethod/creditCard/:actionId/cancel', permitScopes_1.default(['aws.cognito.signin.user.admin', 'transactions']), validator_1.default, rateLimit4transactionInProgress, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        yield cinerino.service.transaction.placeOrderInProgress.action.authorize.paymentMethod.creditCard.cancel({
            id: req.params.actionId,
            agent: { id: req.user.sub },
            transaction: { id: req.params.transactionId }
        })({
            action: new cinerino.repository.Action(mongoose.connection),
            transaction: new cinerino.repository.Transaction(mongoose.connection)
        });
        res.status(http_status_1.NO_CONTENT)
            .end();
    }
    catch (error) {
        next(error);
    }
}));
/**
 * 口座確保
 */
placeOrderTransactionsRouter.post('/:transactionId/actions/authorize/paymentMethod/account', permitScopes_1.default(['aws.cognito.signin.user.admin', 'transactions']), ...[
    check_1.body('typeOf')
        .not()
        .isEmpty()
        .withMessage((_, options) => `${options.path} is required`),
    check_1.body('amount')
        .not()
        .isEmpty()
        .withMessage((_, options) => `${options.path} is required`)
        .isInt(),
    check_1.body('additionalProperty')
        .optional()
        .isArray(),
    check_1.body('fromAccount')
        .not()
        .isEmpty()
        .withMessage((_, options) => `${options.path} is required`)
], validator_1.default, rateLimit4transactionInProgress, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        let fromAccount = req.body.fromAccount;
        // トークン化された口座情報に対応
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
        // pecorino転送取引サービスクライアントを生成
        const transferService = new cinerino.pecorinoapi.service.transaction.Transfer({
            endpoint: process.env.PECORINO_ENDPOINT,
            auth: pecorinoAuthClient
        });
        const action = yield cinerino.service.transaction.placeOrderInProgress.action.authorize.paymentMethod.account.create({
            object: {
                typeOf: cinerino.factory.paymentMethodType.Account,
                amount: req.body.amount,
                additionalProperty: req.body.additionalProperty,
                fromAccount: {
                    accountType: fromAccount.accountType,
                    accountNumber: fromAccount.accountNumber
                },
                notes: req.body.notes
            },
            agent: { id: req.user.sub },
            transaction: { id: req.params.transactionId }
        })({
            action: new cinerino.repository.Action(mongoose.connection),
            seller: new cinerino.repository.Seller(mongoose.connection),
            ownershipInfo: new cinerino.repository.OwnershipInfo(mongoose.connection),
            transaction: new cinerino.repository.Transaction(mongoose.connection),
            transferTransactionService: transferService
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
placeOrderTransactionsRouter.put('/:transactionId/actions/authorize/paymentMethod/account/:actionId/cancel', permitScopes_1.default(['aws.cognito.signin.user.admin', 'transactions']), validator_1.default, rateLimit4transactionInProgress, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const withdrawService = new cinerino.pecorinoapi.service.transaction.Withdraw({
            endpoint: process.env.PECORINO_ENDPOINT,
            auth: pecorinoAuthClient
        });
        const transferService = new cinerino.pecorinoapi.service.transaction.Transfer({
            endpoint: process.env.PECORINO_ENDPOINT,
            auth: pecorinoAuthClient
        });
        yield cinerino.service.transaction.placeOrderInProgress.action.authorize.paymentMethod.account.cancel({
            id: req.params.actionId,
            agent: { id: req.user.sub },
            transaction: { id: req.params.transactionId }
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
/**
 * ムビチケ承認
 */
placeOrderTransactionsRouter.post('/:transactionId/actions/authorize/paymentMethod/movieTicket', permitScopes_1.default(['aws.cognito.signin.user.admin', 'transactions']), ...[
    check_1.body('typeOf')
        .not()
        .isEmpty()
        .withMessage((_, options) => `${options.path} is required`),
    check_1.body('amount')
        .not()
        .isEmpty()
        .withMessage((_, options) => `${options.path} is required`)
        .isInt(),
    check_1.body('additionalProperty')
        .optional()
        .isArray(),
    check_1.body('movieTickets')
        .not()
        .isEmpty()
        .withMessage((_, options) => `${options.path} is required`)
        .isArray()
], validator_1.default, rateLimit4transactionInProgress, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const action = yield cinerino.service.transaction.placeOrderInProgress.action.authorize.paymentMethod.movieTicket.create({
            object: {
                typeOf: cinerino.factory.paymentMethodType.MovieTicket,
                amount: 0,
                additionalProperty: req.body.additionalProperty,
                movieTickets: req.body.movieTickets
            },
            agent: { id: req.user.sub },
            transaction: { id: req.params.transactionId }
        })({
            action: new cinerino.repository.Action(mongoose.connection),
            event: new cinerino.repository.Event(mongoose.connection),
            seller: new cinerino.repository.Seller(mongoose.connection),
            transaction: new cinerino.repository.Transaction(mongoose.connection),
            movieTicket: new cinerino.repository.paymentMethod.MovieTicket({
                endpoint: process.env.MVTK_RESERVE_ENDPOINT,
                auth: mvtkReserveAuthClient
            })
        });
        res.status(http_status_1.CREATED)
            .json(action);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * ムビチケ承認取消
 */
placeOrderTransactionsRouter.put('/:transactionId/actions/authorize/paymentMethod/movieTicket/:actionId/cancel', permitScopes_1.default(['aws.cognito.signin.user.admin', 'transactions']), validator_1.default, rateLimit4transactionInProgress, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        yield cinerino.service.transaction.placeOrderInProgress.action.authorize.paymentMethod.movieTicket.cancel({
            id: req.params.actionId,
            agent: { id: req.user.sub },
            transaction: { id: req.params.transactionId }
        })({
            action: new cinerino.repository.Action(mongoose.connection),
            transaction: new cinerino.repository.Transaction(mongoose.connection)
        });
        res.status(http_status_1.NO_CONTENT)
            .end();
    }
    catch (error) {
        next(error);
    }
}));
/**
 * ポイントインセンティブ承認アクション
 */
placeOrderTransactionsRouter.post('/:transactionId/actions/authorize/award/accounts/point', permitScopes_1.default(['aws.cognito.signin.user.admin', 'transactions']), (req, __2, next) => {
    req.checkBody('amount', 'invalid amount')
        .notEmpty()
        .withMessage('amount is required')
        .isInt()
        .toInt();
    req.checkBody('toAccountNumber', 'invalid toAccountNumber')
        .notEmpty()
        .withMessage('toAccountNumber is required');
    next();
}, validator_1.default, rateLimit4transactionInProgress, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        // pecorino転送取引サービスクライアントを生成
        const depositService = new cinerino.pecorinoapi.service.transaction.Deposit({
            endpoint: process.env.PECORINO_ENDPOINT,
            auth: pecorinoAuthClient
        });
        const action = yield cinerino.service.transaction.placeOrderInProgress.action.authorize.award.point.create({
            transaction: { id: req.params.transactionId },
            agent: { id: req.user.sub },
            object: req.body
        })({
            action: new cinerino.repository.Action(mongoose.connection),
            transaction: new cinerino.repository.Transaction(mongoose.connection),
            ownershipInfo: new cinerino.repository.OwnershipInfo(mongoose.connection),
            depositTransactionService: depositService
        });
        res.status(http_status_1.CREATED)
            .json(action);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * ポイントインセンティブ承認アクション取消
 */
placeOrderTransactionsRouter.put('/:transactionId/actions/authorize/award/accounts/point/:actionId/cancel', permitScopes_1.default(['aws.cognito.signin.user.admin', 'transactions']), (__1, __2, next) => {
    next();
}, validator_1.default, rateLimit4transactionInProgress, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const depositService = new cinerino.pecorinoapi.service.transaction.Deposit({
            endpoint: process.env.PECORINO_ENDPOINT,
            auth: pecorinoAuthClient
        });
        yield cinerino.service.transaction.placeOrderInProgress.action.authorize.award.point.cancel({
            agent: { id: req.user.sub },
            transaction: { id: req.params.transactionId },
            id: req.params.actionId
        })({
            action: new cinerino.repository.Action(mongoose.connection),
            transaction: new cinerino.repository.Transaction(mongoose.connection),
            depositTransactionService: depositService
        });
        res.status(http_status_1.NO_CONTENT)
            .end();
    }
    catch (error) {
        next(error);
    }
}));
placeOrderTransactionsRouter.put('/:transactionId/confirm', permitScopes_1.default(['aws.cognito.signin.user.admin', 'transactions']), validator_1.default, rateLimit4transactionInProgress, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const orderDate = new Date();
        const actionRepo = new cinerino.repository.Action(mongoose.connection);
        const transactionRepo = new cinerino.repository.Transaction(mongoose.connection);
        const confirmationNumberRepo = new cinerino.repository.ConfirmationNumber(redis.getClient());
        const orderNumberRepo = new cinerino.repository.OrderNumber(redis.getClient());
        const sellerRepo = new cinerino.repository.Seller(mongoose.connection);
        const taskRepo = new cinerino.repository.Task(mongoose.connection);
        const result = yield cinerino.service.transaction.placeOrderInProgress.confirm({
            id: req.params.transactionId,
            agent: { id: req.user.sub },
            result: { order: { orderDate: orderDate } },
            options: Object.assign({}, req.body, { sendEmailMessage: (req.body.sendEmailMessage === true) ? true : false })
        })({
            action: actionRepo,
            transaction: transactionRepo,
            confirmationNumber: confirmationNumberRepo,
            orderNumber: orderNumberRepo,
            seller: sellerRepo
        });
        debug('transaction confirmed');
        // 非同期でタスクエクスポート(APIレスポンスタイムに影響を与えないように)
        // tslint:disable-next-line:no-floating-promises
        cinerino.service.transaction.placeOrder.exportTasks(cinerino.factory.transactionStatusType.Confirmed)({
            task: taskRepo,
            transaction: transactionRepo
        });
        res.json(result);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * 取引を明示的に中止
 */
placeOrderTransactionsRouter.put('/:transactionId/cancel', permitScopes_1.default(['aws.cognito.signin.user.admin', 'transactions']), validator_1.default, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const taskRepo = new cinerino.repository.Task(mongoose.connection);
        const transactionRepo = new cinerino.repository.Transaction(mongoose.connection);
        yield transactionRepo.cancel({ typeOf: cinerino.factory.transactionType.PlaceOrder, id: req.params.transactionId });
        // 非同期でタスクエクスポート(APIレスポンスタイムに影響を与えないように)
        // tslint:disable-next-line:no-floating-promises
        cinerino.service.transaction.placeOrder.exportTasks(cinerino.factory.transactionStatusType.Canceled)({
            task: taskRepo,
            transaction: transactionRepo
        });
        res.status(http_status_1.NO_CONTENT)
            .end();
    }
    catch (error) {
        next(error);
    }
}));
/**
 * 取引検索
 */
placeOrderTransactionsRouter.get('', permitScopes_1.default(['admin']), ...[
    check_1.query('startFrom')
        .optional()
        .isISO8601()
        .toDate(),
    check_1.query('startThrough')
        .optional()
        .isISO8601()
        .toDate(),
    check_1.query('endFrom')
        .optional()
        .isISO8601()
        .toDate(),
    check_1.query('endThrough')
        .optional()
        .isISO8601()
        .toDate()
], validator_1.default, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const transactionRepo = new cinerino.repository.Transaction(mongoose.connection);
        const searchConditions = Object.assign({}, req.query, { 
            // tslint:disable-next-line:no-magic-numbers
            limit: (req.query.limit !== undefined) ? Math.min(req.query.limit, 100) : 100, page: (req.query.page !== undefined) ? Math.max(req.query.page, 1) : 1, typeOf: cinerino.factory.transactionType.PlaceOrder });
        const transactions = yield transactionRepo.search(searchConditions);
        const totalCount = yield transactionRepo.count(searchConditions);
        res.set('X-Total-Count', totalCount.toString());
        res.json(transactions);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * 取引に対するアクション検索
 */
placeOrderTransactionsRouter.get('/:transactionId/actions', permitScopes_1.default(['admin']), validator_1.default, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const actionRepo = new cinerino.repository.Action(mongoose.connection);
        const actions = yield actionRepo.searchByPurpose({
            purpose: {
                typeOf: cinerino.factory.transactionType.PlaceOrder,
                id: req.params.transactionId
            },
            sort: req.query.sort
        });
        res.json(actions);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * 取引レポート
 */
placeOrderTransactionsRouter.get('/report', permitScopes_1.default(['admin']), validator_1.default, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const transactionRepo = new cinerino.repository.Transaction(mongoose.connection);
        const searchConditions = {
            limit: undefined,
            page: undefined,
            typeOf: cinerino.factory.transactionType.PlaceOrder,
            ids: (Array.isArray(req.query.ids)) ? req.query.ids : undefined,
            statuses: (Array.isArray(req.query.statuses)) ? req.query.statuses : undefined,
            startFrom: (req.query.startFrom !== undefined) ? moment(req.query.startFrom)
                .toDate() : undefined,
            startThrough: (req.query.startThrough !== undefined) ? moment(req.query.startThrough)
                .toDate() : undefined,
            endFrom: (req.query.endFrom !== undefined) ? moment(req.query.endFrom)
                .toDate() : undefined,
            endThrough: (req.query.endThrough !== undefined) ? moment(req.query.endThrough)
                .toDate() : undefined,
            agent: req.query.agent,
            seller: req.query.seller,
            object: req.query.object,
            result: req.query.result
        };
        const stream = yield cinerino.service.report.transaction.download({
            conditions: searchConditions,
            format: req.query.format
        })({ transaction: transactionRepo });
        res.type(`${req.query.format}; charset=utf-8`);
        stream.pipe(res);
    }
    catch (error) {
        next(error);
    }
}));
exports.default = placeOrderTransactionsRouter;
