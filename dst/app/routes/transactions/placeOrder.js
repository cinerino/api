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
const http_status_1 = require("http-status");
const ioredis = require("ioredis");
const moment = require("moment");
const authentication_1 = require("../../middlewares/authentication");
const permitScopes_1 = require("../../middlewares/permitScopes");
const validator_1 = require("../../middlewares/validator");
const redis = require("../../../redis");
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
        tls: { servername: process.env.REDIS_HOST }
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
placeOrderTransactionsRouter.post('/start', permitScopes_1.default(['aws.cognito.signin.user.admin', 'transactions']), (req, _, next) => {
    // expires is unix timestamp (in seconds)
    req.checkBody('expires', 'invalid expires').notEmpty().withMessage('expires is required');
    req.checkBody('sellerId', 'invalid sellerId').notEmpty().withMessage('sellerId is required');
    next();
}, validator_1.default, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const passportToken = req.body.passportToken;
        // 許可証トークンパラメーターがなければ、WAITERで許可証を取得
        // if (passportToken === undefined) {
        //     const organizationRepo = new cinerino.repository.Organization(cinerino.mongoose.connection);
        //     const seller = await organizationRepo.findById(cinerino.factory.organizationType.MovieTheater, req.body.sellerId);
        //     try {
        //         passportToken = await request.post(
        //             `${process.env.WAITER_ENDPOINT}/passports`,
        //             {
        //                 body: {
        //                     scope: `placeOrderTransaction.${seller.identifier}`
        //                 },
        //                 json: true
        //             }
        //         ).then((body) => body.token);
        //     } catch (error) {
        //         if (error.statusCode === NOT_FOUND) {
        //             throw new cinerino.factory.errors.NotFound('sellerId', 'Seller does not exist.');
        //         } else if (error.statusCode === TOO_MANY_REQUESTS) {
        //             throw new cinerino.factory.errors.RateLimitExceeded('PlaceOrder transactions rate limit exceeded.');
        //         } else {
        //             throw new cinerino.factory.errors.ServiceUnavailable('Waiter service temporarily unavailable.');
        //         }
        //     }
        // }
        const transaction = yield cinerino.service.transaction.placeOrderInProgress.start({
            expires: moment(req.body.expires).toDate(),
            customer: req.agent,
            seller: {
                typeOf: cinerino.factory.organizationType.MovieTheater,
                id: req.body.sellerId
            },
            clientUser: req.user,
            passportToken: passportToken
        })({
            organization: new cinerino.repository.Organization(cinerino.mongoose.connection),
            transaction: new cinerino.repository.Transaction(cinerino.mongoose.connection)
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
    req.checkBody('familyName').notEmpty().withMessage('required');
    req.checkBody('givenName').notEmpty().withMessage('required');
    req.checkBody('telephone').notEmpty().withMessage('required');
    req.checkBody('email').notEmpty().withMessage('required');
    next();
}, validator_1.default, rateLimit4transactionInProgress, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const contact = yield cinerino.service.transaction.placeOrderInProgress.setCustomerContact({
            agentId: req.user.sub,
            transactionId: req.params.transactionId,
            contact: {
                familyName: req.body.familyName,
                givenName: req.body.givenName,
                email: req.body.email,
                telephone: req.body.telephone
            }
        })({
            transaction: new cinerino.repository.Transaction(cinerino.mongoose.connection)
        });
        res.status(http_status_1.CREATED).json(contact);
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
        const reserveService = new cinerino.chevre.service.transaction.Reserve({
            endpoint: process.env.CHEVRE_ENDPOINT,
            auth: chevreAuthClient
        });
        const action = yield cinerino.service.transaction.placeOrderInProgress.action.authorize.offer.seatReservation.create({
            agentId: req.user.sub,
            transactionId: req.params.transactionId,
            event: req.body.event,
            tickets: req.body.tickets,
            notes: req.body.notes
        })({
            action: new cinerino.repository.Action(cinerino.mongoose.connection),
            transaction: new cinerino.repository.Transaction(cinerino.mongoose.connection),
            event: new cinerino.repository.Event(cinerino.mongoose.connection),
            reserveService: reserveService
        });
        res.status(http_status_1.CREATED).json(action);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * 座席仮予約削除
 */
placeOrderTransactionsRouter.delete('/:transactionId/actions/authorize/offer/seatReservation/:actionId', permitScopes_1.default(['aws.cognito.signin.user.admin', 'transactions']), validator_1.default, rateLimit4transactionInProgress, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        yield cinerino.service.transaction.placeOrderInProgress.action.authorize.offer.seatReservation.cancel({
            agentId: req.user.sub,
            transactionId: req.params.transactionId,
            actionId: req.params.actionId
        })({
            action: new cinerino.repository.Action(cinerino.mongoose.connection),
            transaction: new cinerino.repository.Transaction(cinerino.mongoose.connection)
        });
        res.status(http_status_1.NO_CONTENT).end();
    }
    catch (error) {
        next(error);
    }
}));
/**
 * 会員プログラムオファー承認アクション
 */
placeOrderTransactionsRouter.post('/:transactionId/actions/authorize/offer/programMembership', permitScopes_1.default(['aws.cognito.signin.user.admin', 'transactions']), (__1, __2, next) => {
    next();
}, validator_1.default, rateLimit4transactionInProgress, (_, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        // tslint:disable-next-line:no-suspicious-comment
        // TODO 実装
        res.status(http_status_1.CREATED).json({});
    }
    catch (error) {
        next(error);
    }
}));
/**
 * 会員プログラムオファー承認アクション取消
 */
placeOrderTransactionsRouter.delete('/:transactionId/actions/authorize/offer/programMembership/:actionId', permitScopes_1.default(['aws.cognito.signin.user.admin', 'transactions']), (__1, __2, next) => {
    next();
}, validator_1.default, rateLimit4transactionInProgress, (_, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        // tslint:disable-next-line:no-suspicious-comment
        // TODO 実装
        res.status(http_status_1.NO_CONTENT).end();
    }
    catch (error) {
        next(error);
    }
}));
/**
 * クレジットカードオーソリ
 */
placeOrderTransactionsRouter.post('/:transactionId/actions/authorize/paymentMethod/creditCard', permitScopes_1.default(['aws.cognito.signin.user.admin', 'transactions']), (req, __2, next) => {
    req.checkBody('orderId', 'invalid orderId').notEmpty().withMessage('orderId is required');
    req.checkBody('amount', 'invalid amount').notEmpty().withMessage('amount is required');
    req.checkBody('method', 'invalid method').notEmpty().withMessage('method is required');
    req.checkBody('creditCard', 'invalid creditCard').notEmpty().withMessage('creditCard is required');
    next();
}, validator_1.default, rateLimit4transactionInProgress, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const creditCard = Object.assign({}, req.body.creditCard, { memberId: req.user.sub });
        debug('authorizing credit card...', creditCard);
        debug('authorizing credit card...', req.body.creditCard);
        const action = yield cinerino.service.transaction.placeOrderInProgress.action.authorize.paymentMethod.creditCard.create({
            agentId: req.user.sub,
            transactionId: req.params.transactionId,
            orderId: req.body.orderId,
            amount: req.body.amount,
            method: req.body.method,
            creditCard: creditCard
        })({
            action: new cinerino.repository.Action(cinerino.mongoose.connection),
            transaction: new cinerino.repository.Transaction(cinerino.mongoose.connection),
            organization: new cinerino.repository.Organization(cinerino.mongoose.connection)
        });
        res.status(http_status_1.CREATED).json({
            id: action.id
        });
    }
    catch (error) {
        next(error);
    }
}));
/**
 * クレジットカードオーソリ取消
 */
placeOrderTransactionsRouter.delete('/:transactionId/actions/authorize/paymentMethod/creditCard/:actionId', permitScopes_1.default(['aws.cognito.signin.user.admin', 'transactions']), validator_1.default, rateLimit4transactionInProgress, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        yield cinerino.service.transaction.placeOrderInProgress.action.authorize.paymentMethod.creditCard.cancel({
            agentId: req.user.sub,
            transactionId: req.params.transactionId,
            actionId: req.params.actionId
        })({
            action: new cinerino.repository.Action(cinerino.mongoose.connection),
            transaction: new cinerino.repository.Transaction(cinerino.mongoose.connection)
        });
        res.status(http_status_1.NO_CONTENT).end();
    }
    catch (error) {
        next(error);
    }
}));
/**
 * 口座確保
 */
placeOrderTransactionsRouter.post('/:transactionId/actions/authorize/paymentMethod/account', permitScopes_1.default(['aws.cognito.signin.user.admin', 'transactions']), (req, __, next) => {
    req.checkBody('amount', 'invalid amount').notEmpty().withMessage('amount is required').isInt();
    req.checkBody('fromAccount', 'invalid fromAccount').notEmpty().withMessage('fromAccount is required');
    next();
}, validator_1.default, rateLimit4transactionInProgress, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        let fromAccount = req.body.fromAccount;
        // トークン化された口座情報に対応
        if (typeof fromAccount === 'string') {
            const accountOwnershipInfo = yield cinerino.service.code.verifyToken({
                agent: req.agent,
                token: fromAccount,
                secret: process.env.TOKEN_SECRET,
                issuer: process.env.RESOURCE_SERVER_IDENTIFIER
            })({ action: new cinerino.repository.Action(cinerino.mongoose.connection) });
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
            transactionId: req.params.transactionId,
            amount: Number(req.body.amount),
            fromAccount: {
                accountType: fromAccount.accountType,
                accountNumber: fromAccount.accountNumber
            },
            notes: req.body.notes
        })({
            action: new cinerino.repository.Action(cinerino.mongoose.connection),
            organization: new cinerino.repository.Organization(cinerino.mongoose.connection),
            ownershipInfo: new cinerino.repository.OwnershipInfo(cinerino.mongoose.connection),
            transaction: new cinerino.repository.Transaction(cinerino.mongoose.connection),
            transferTransactionService: transferService
        });
        res.status(http_status_1.CREATED).json(action);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * ポイント口座承認取消
 */
placeOrderTransactionsRouter.delete('/:transactionId/actions/authorize/paymentMethod/account/:actionId', permitScopes_1.default(['aws.cognito.signin.user.admin', 'transactions']), validator_1.default, rateLimit4transactionInProgress, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
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
            agentId: req.user.sub,
            transactionId: req.params.transactionId,
            actionId: req.params.actionId
        })({
            action: new cinerino.repository.Action(cinerino.mongoose.connection),
            transaction: new cinerino.repository.Transaction(cinerino.mongoose.connection),
            transferTransactionService: transferService,
            withdrawTransactionService: withdrawService
        });
        res.status(http_status_1.NO_CONTENT).end();
    }
    catch (error) {
        next(error);
    }
}));
/**
 * Mocoin口座確保
 */
placeOrderTransactionsRouter.post('/:transactionId/actions/authorize/paymentMethod/mocoin', permitScopes_1.default(['aws.cognito.signin.user.admin', 'transactions']), (req, __, next) => {
    req.checkBody('token', 'invalid token').notEmpty().withMessage('token is required');
    req.checkBody('amount', 'invalid amount').notEmpty().withMessage('amount is required').isInt();
    req.checkBody('fromAccountNumber', 'invalid fromAccountNumber').notEmpty().withMessage('fromAccountNumber is required');
    next();
}, validator_1.default, rateLimit4transactionInProgress, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        // mocoin転送取引サービスクライアントを生成
        const authClient = new cinerino.mocoin.auth.OAuth2({
            domain: process.env.MOCOIN_AUTHORIZE_SERVER_DOMAIN,
            clientId: process.env.MOCOIN_CLIENT_ID,
            clientSecret: process.env.MOCOIN_CLIENT_SECRET,
            redirectUri: '',
            logoutUri: ''
        });
        authClient.setCredentials({ access_token: req.body.token });
        const transferService = new cinerino.mocoin.service.transaction.TransferCoin({
            endpoint: process.env.MOCOIN_API_ENDPOINT,
            auth: authClient
        });
        const action = yield cinerino.service.transaction.placeOrderInProgress.action.authorize.paymentMethod.mocoin.create({
            transactionId: req.params.transactionId,
            amount: parseInt(req.body.amount, 10),
            fromAccountNumber: req.body.fromAccountNumber,
            notes: req.body.notes
        })({
            action: new cinerino.repository.Action(cinerino.mongoose.connection),
            organization: new cinerino.repository.Organization(cinerino.mongoose.connection),
            transaction: new cinerino.repository.Transaction(cinerino.mongoose.connection),
            transferService: transferService
        });
        res.status(http_status_1.CREATED).json(action);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * Mocoin口座承認取消
 */
// placeOrderTransactionsRouter.delete(
//     '/:transactionId/actions/authorize/paymentMethod/mocoin/:actionId',
//     permitScopes(['aws.cognito.signin.user.admin', 'transactions']),
//     validator,
//     rateLimit4transactionInProgress,
//     async (req, res, next) => {
//         try {
//             // pecorino転送取引サービスクライアントを生成
//             const transferService = new cinerino.mocoin.service.transaction.TransferCoin({
//                 endpoint: <string>process.env.PECORINO_ENDPOINT,
//                 auth: pecorinoAuthClient
//             });
//             await cinerino.service.transaction.placeOrderInProgress.action.authorize.paymentMethod.mocoin.cancel({
//                 agentId: req.user.sub,
//                 transactionId: req.params.transactionId,
//                 actionId: req.params.actionId
//             })({
//                 action: new cinerino.repository.Action(cinerino.mongoose.connection),
//                 transaction: new cinerino.repository.Transaction(cinerino.mongoose.connection),
//                 transferService: transferService
//             });
//             res.status(NO_CONTENT).end();
//         } catch (error) {
//             next(error);
//         }
//     }
// );
/**
 * ポイントインセンティブ承認アクション
 */
placeOrderTransactionsRouter.post('/:transactionId/actions/authorize/award/accounts/point', permitScopes_1.default(['aws.cognito.signin.user.admin', 'transactions']), (req, __2, next) => {
    req.checkBody('amount', 'invalid amount').notEmpty().withMessage('amount is required').isInt();
    req.checkBody('toAccountNumber', 'invalid toAccountNumber').notEmpty().withMessage('toAccountNumber is required');
    next();
}, validator_1.default, rateLimit4transactionInProgress, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        // pecorino転送取引サービスクライアントを生成
        const depositService = new cinerino.pecorinoapi.service.transaction.Deposit({
            endpoint: process.env.PECORINO_ENDPOINT,
            auth: pecorinoAuthClient
        });
        const action = yield cinerino.service.transaction.placeOrderInProgress.action.authorize.award.point.create({
            agentId: req.user.sub,
            transactionId: req.params.transactionId,
            amount: parseInt(req.body.amount, 10),
            toAccountNumber: req.body.toAccountNumber,
            notes: req.body.notes
        })({
            action: new cinerino.repository.Action(cinerino.mongoose.connection),
            transaction: new cinerino.repository.Transaction(cinerino.mongoose.connection),
            ownershipInfo: new cinerino.repository.OwnershipInfo(cinerino.mongoose.connection),
            depositTransactionService: depositService
        });
        res.status(http_status_1.CREATED).json(action);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * ポイントインセンティブ承認アクション取消
 */
placeOrderTransactionsRouter.delete('/:transactionId/actions/authorize/award/accounts/point/:actionId', permitScopes_1.default(['aws.cognito.signin.user.admin', 'transactions']), (__1, __2, next) => {
    next();
}, validator_1.default, rateLimit4transactionInProgress, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const depositService = new cinerino.pecorinoapi.service.transaction.Deposit({
            endpoint: process.env.PECORINO_ENDPOINT,
            auth: pecorinoAuthClient
        });
        yield cinerino.service.transaction.placeOrderInProgress.action.authorize.award.point.cancel({
            agentId: req.user.sub,
            transactionId: req.params.transactionId,
            actionId: req.params.actionId
        })({
            action: new cinerino.repository.Action(cinerino.mongoose.connection),
            transaction: new cinerino.repository.Transaction(cinerino.mongoose.connection),
            depositTransactionService: depositService
        });
        res.status(http_status_1.NO_CONTENT).end();
    }
    catch (error) {
        next(error);
    }
}));
placeOrderTransactionsRouter.put('/:transactionId/confirm', permitScopes_1.default(['aws.cognito.signin.user.admin', 'transactions']), validator_1.default, rateLimit4transactionInProgress, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const orderDate = new Date();
        const result = yield cinerino.service.transaction.placeOrderInProgress.confirm({
            agentId: req.user.sub,
            transactionId: req.params.transactionId,
            sendEmailMessage: (req.body.sendEmailMessage === true) ? true : false,
            orderDate: orderDate
        })({
            action: new cinerino.repository.Action(cinerino.mongoose.connection),
            transaction: new cinerino.repository.Transaction(cinerino.mongoose.connection),
            orderNumber: new cinerino.repository.OrderNumber(redis.getClient()),
            organization: new cinerino.repository.Organization(cinerino.mongoose.connection)
        });
        debug('transaction confirmed');
        res.json(result);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * 取引を明示的に中止
 */
placeOrderTransactionsRouter.put('/:transactionId/cancel', permitScopes_1.default(['admin', 'aws.cognito.signin.user.admin', 'transactions']), validator_1.default, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const transactionRepo = new cinerino.repository.Transaction(cinerino.mongoose.connection);
        yield transactionRepo.cancel(cinerino.factory.transactionType.PlaceOrder, req.params.transactionId);
        debug('transaction canceled.');
        res.status(http_status_1.NO_CONTENT).end();
    }
    catch (error) {
        next(error);
    }
}));
placeOrderTransactionsRouter.post('/:transactionId/tasks/sendEmailNotification', permitScopes_1.default(['aws.cognito.signin.user.admin', 'transactions']), validator_1.default, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const task = yield cinerino.service.transaction.placeOrder.sendEmail(req.params.transactionId, {
            typeOf: cinerino.factory.creativeWorkType.EmailMessage,
            sender: {
                name: req.body.sender.name,
                email: req.body.sender.email
            },
            toRecipient: {
                name: req.body.toRecipient.name,
                email: req.body.toRecipient.email
            },
            about: req.body.about,
            text: req.body.text
        })({
            task: new cinerino.repository.Task(cinerino.mongoose.connection),
            transaction: new cinerino.repository.Transaction(cinerino.mongoose.connection)
        });
        res.status(http_status_1.CREATED).json(task);
    }
    catch (error) {
        next(error);
    }
}));
exports.default = placeOrderTransactionsRouter;
