/**
 * 注文取引ルーター
 */
import * as cinerino from '@cinerino/domain';

import * as middlewares from '@motionpicture/express-middleware';
import * as createDebug from 'debug';
import { Router } from 'express';
// tslint:disable-next-line:no-submodule-imports
import { body } from 'express-validator/check';
import { CREATED, NO_CONTENT } from 'http-status';
import * as ioredis from 'ioredis';
import * as moment from 'moment';

import authentication from '../../middlewares/authentication';
import permitScopes from '../../middlewares/permitScopes';
import validator from '../../middlewares/validator';

import * as redis from '../../../redis';

const WAITER_DISABLED = process.env.WAITER_DISABLED === '1';
const placeOrderTransactionsRouter = Router();
const debug = createDebug('cinerino-api:router');
const pecorinoAuthClient = new cinerino.pecorinoapi.auth.ClientCredentials({
    domain: <string>process.env.PECORINO_AUTHORIZE_SERVER_DOMAIN,
    clientId: <string>process.env.PECORINO_CLIENT_ID,
    clientSecret: <string>process.env.PECORINO_CLIENT_SECRET,
    scopes: [],
    state: ''
});
const chevreAuthClient = new cinerino.chevre.auth.ClientCredentials({
    domain: <string>process.env.CHEVRE_AUTHORIZE_SERVER_DOMAIN,
    clientId: <string>process.env.CHEVRE_CLIENT_ID,
    clientSecret: <string>process.env.CHEVRE_CLIENT_SECRET,
    scopes: [],
    state: ''
});
const mvtkReserveAuthClient = new cinerino.mvtkreserveapi.auth.ClientCredentials({
    domain: <string>process.env.MVTK_RESERVE_AUTHORIZE_SERVER_DOMAIN,
    clientId: <string>process.env.MVTK_RESERVE_CLIENT_ID,
    clientSecret: <string>process.env.MVTK_RESERVE_CLIENT_SECRET,
    scopes: [],
    state: ''
});
// tslint:disable-next-line:no-magic-numbers
const UNIT_IN_SECONDS = parseInt(<string>process.env.TRANSACTION_RATE_LIMIT_UNIT_IN_SECONDS, 10);
// tslint:disable-next-line:no-magic-numbers
const THRESHOLD = parseInt(<string>process.env.TRANSACTION_RATE_LIMIT_THRESHOLD, 10);
/**
 * 進行中取引の接続回数制限ミドルウェア
 * 取引IDを使用して動的にスコープを作成する
 */
const rateLimit4transactionInProgress =
    middlewares.rateLimit({
        redisClient: new ioredis({
            host: <string>process.env.REDIS_HOST,
            // tslint:disable-next-line:no-magic-numbers
            port: parseInt(<string>process.env.REDIS_PORT, 10),
            password: <string>process.env.REDIS_KEY,
            tls: { servername: <string>process.env.REDIS_HOST }
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
placeOrderTransactionsRouter.use(authentication);
placeOrderTransactionsRouter.post(
    '/start',
    permitScopes(['aws.cognito.signin.user.admin', 'transactions']),
    (req, _, next) => {
        req.checkBody('expires', 'invalid expires').notEmpty().withMessage('expires is required').isISO8601();
        req.checkBody('agent.identifier', 'invalid agent identifier').optional().isArray();
        req.checkBody('seller.typeOf', 'invalid seller type').notEmpty().withMessage('seller.typeOf is required');
        req.checkBody('seller.id', 'invalid seller id').notEmpty().withMessage('seller.id is required');
        if (!WAITER_DISABLED) {
            req.checkBody('object.passport.token', 'invalid passport token').notEmpty().withMessage('object.passport.token is required');
        }
        next();
    },
    validator,
    async (req, res, next) => {
        try {
            // WAITER有効設定であれば許可証をセット
            let passport: cinerino.factory.transaction.placeOrder.IPassportBeforeStart | undefined;
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

            const transaction = await cinerino.service.transaction.placeOrderInProgress.start({
                expires: moment(req.body.expires).toDate(),
                agent: {
                    ...req.agent,
                    identifier: (req.body.agent !== undefined)
                        ? req.body.agent.identifier
                        : undefined
                },
                seller: req.body.seller,
                object: {
                    clientUser: req.user,
                    passport: passport
                }
            })({
                organization: new cinerino.repository.Organization(cinerino.mongoose.connection),
                transaction: new cinerino.repository.Transaction(cinerino.mongoose.connection)
            });

            // tslint:disable-next-line:no-string-literal
            // const host = req.headers['host'];
            // res.setHeader('Location', `https://${host}/transactions/${transaction.id}`);
            res.json(transaction);
        } catch (error) {
            next(error);
        }
    }
);
/**
 * 購入者情報を変更する
 */
placeOrderTransactionsRouter.put(
    '/:transactionId/customerContact',
    permitScopes(['aws.cognito.signin.user.admin', 'transactions']),
    (req, _, next) => {
        req.checkBody('familyName').notEmpty().withMessage('required');
        req.checkBody('givenName').notEmpty().withMessage('required');
        req.checkBody('telephone').notEmpty().withMessage('required');
        req.checkBody('email').notEmpty().withMessage('required');
        next();
    },
    validator,
    rateLimit4transactionInProgress,
    async (req, res, next) => {
        try {
            const contact = await cinerino.service.transaction.placeOrderInProgress.setCustomerContact({
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
            res.json(contact);
        } catch (error) {
            next(error);
        }
    }
);
/**
 * 座席仮予約
 */
placeOrderTransactionsRouter.post(
    '/:transactionId/actions/authorize/offer/seatReservation',
    permitScopes(['aws.cognito.signin.user.admin', 'transactions']),
    (__1, __2, next) => {
        next();
    },
    validator,
    rateLimit4transactionInProgress,
    async (req, res, next) => {
        try {
            const eventService = new cinerino.chevre.service.Event({
                endpoint: <string>process.env.CHEVRE_ENDPOINT,
                auth: chevreAuthClient
            });
            const reserveService = new cinerino.chevre.service.transaction.Reserve({
                endpoint: <string>process.env.CHEVRE_ENDPOINT,
                auth: chevreAuthClient
            });
            const action = await cinerino.service.transaction.placeOrderInProgress.action.authorize.offer.seatReservation.create({
                agentId: req.user.sub,
                transactionId: req.params.transactionId,
                event: req.body.event,
                acceptedOffer: req.body.acceptedOffer,
                notes: req.body.notes
            })({
                action: new cinerino.repository.Action(cinerino.mongoose.connection),
                transaction: new cinerino.repository.Transaction(cinerino.mongoose.connection),
                event: new cinerino.repository.Event(cinerino.mongoose.connection),
                eventService: eventService,
                reserveService: reserveService
            });

            res.status(CREATED).json(action);
        } catch (error) {
            next(error);
        }
    }
);
/**
 * 座席仮予約取消
 */
placeOrderTransactionsRouter.put(
    '/:transactionId/actions/authorize/offer/seatReservation/:actionId/cancel',
    permitScopes(['aws.cognito.signin.user.admin', 'transactions']),
    validator,
    rateLimit4transactionInProgress,
    async (req, res, next) => {
        try {
            const reserveService = new cinerino.chevre.service.transaction.Reserve({
                endpoint: <string>process.env.CHEVRE_ENDPOINT,
                auth: chevreAuthClient
            });
            await cinerino.service.transaction.placeOrderInProgress.action.authorize.offer.seatReservation.cancel({
                agentId: req.user.sub,
                transactionId: req.params.transactionId,
                actionId: req.params.actionId
            })({
                action: new cinerino.repository.Action(cinerino.mongoose.connection),
                transaction: new cinerino.repository.Transaction(cinerino.mongoose.connection),
                reserveService: reserveService
            });

            res.status(NO_CONTENT).end();
        } catch (error) {
            next(error);
        }
    }
);
/**
 * 汎用決済承認
 */
placeOrderTransactionsRouter.post(
    '/:transactionId/actions/authorize/paymentMethod/any',
    permitScopes(['admin', 'admin.transactions']),
    ...[
        body('typeOf').not().isEmpty().withMessage((_, options) => `${options.path} is required`),
        body('amount').not().isEmpty().withMessage((_, options) => `${options.path} is required`).isInt(),
        body('additionalProperty').optional().isArray()
    ],
    validator,
    rateLimit4transactionInProgress,
    async (req, res, next) => {
        try {
            const action = await cinerino.service.transaction.placeOrderInProgress.action.authorize.paymentMethod.any.create({
                agentId: req.user.sub,
                transactionId: req.params.transactionId,
                ...req.body
            })({
                action: new cinerino.repository.Action(cinerino.mongoose.connection),
                transaction: new cinerino.repository.Transaction(cinerino.mongoose.connection),
                organization: new cinerino.repository.Organization(cinerino.mongoose.connection)
            });
            res.status(CREATED).json(action);
        } catch (error) {
            next(error);
        }
    }
);
/**
 * 汎用決済承認取消
 */
placeOrderTransactionsRouter.put(
    '/:transactionId/actions/authorize/paymentMethod/any/:actionId/cancel',
    permitScopes(['admin', 'admin.transactions']),
    validator,
    rateLimit4transactionInProgress,
    async (req, res, next) => {
        try {
            await cinerino.service.transaction.placeOrderInProgress.action.authorize.paymentMethod.any.cancel({
                agentId: req.user.sub,
                transactionId: req.params.transactionId,
                actionId: req.params.actionId
            })({
                action: new cinerino.repository.Action(cinerino.mongoose.connection),
                transaction: new cinerino.repository.Transaction(cinerino.mongoose.connection)
            });
            res.status(NO_CONTENT).end();
        } catch (error) {
            next(error);
        }
    }
);
/**
 * クレジットカードオーソリ
 */
placeOrderTransactionsRouter.post(
    '/:transactionId/actions/authorize/paymentMethod/creditCard',
    permitScopes(['aws.cognito.signin.user.admin', 'transactions']),
    ...[
        body('typeOf').not().isEmpty().withMessage((_, options) => `${options.path} is required`),
        body('amount').not().isEmpty().withMessage((_, options) => `${options.path} is required`).isInt(),
        body('additionalProperty').optional().isArray(),
        body('orderId').not().isEmpty().withMessage((_, options) => `${options.path} is required`).isLength({ max: 27 }),
        body('method').not().isEmpty().withMessage((_, options) => `${options.path} is required`),
        body('creditCard').not().isEmpty().withMessage((_, options) => `${options.path} is required`)
    ],
    validator,
    rateLimit4transactionInProgress,
    async (req, res, next) => {
        try {
            // 会員IDを強制的にログイン中の人物IDに変更
            type ICreditCard4authorizeAction = cinerino.factory.action.authorize.paymentMethod.creditCard.ICreditCard;
            const creditCard: ICreditCard4authorizeAction = {
                ...req.body.creditCard,
                memberId: req.user.sub
            };
            debug('authorizing credit card...', creditCard);

            debug('authorizing credit card...', req.body.creditCard);
            const action = await cinerino.service.transaction.placeOrderInProgress.action.authorize.paymentMethod.creditCard.create({
                typeOf: cinerino.factory.paymentMethodType.CreditCard,
                agentId: req.user.sub,
                transactionId: req.params.transactionId,
                additionalProperty: req.body.additionalProperty,
                orderId: req.body.orderId,
                amount: req.body.amount,
                method: req.body.method,
                creditCard: creditCard
            })({
                action: new cinerino.repository.Action(cinerino.mongoose.connection),
                transaction: new cinerino.repository.Transaction(cinerino.mongoose.connection),
                organization: new cinerino.repository.Organization(cinerino.mongoose.connection)
            });

            res.status(CREATED).json({
                id: action.id
            });
        } catch (error) {
            next(error);
        }
    }
);
/**
 * クレジットカードオーソリ取消
 */
placeOrderTransactionsRouter.put(
    '/:transactionId/actions/authorize/paymentMethod/creditCard/:actionId/cancel',
    permitScopes(['aws.cognito.signin.user.admin', 'transactions']),
    validator,
    rateLimit4transactionInProgress,
    async (req, res, next) => {
        try {
            await cinerino.service.transaction.placeOrderInProgress.action.authorize.paymentMethod.creditCard.cancel({
                agentId: req.user.sub,
                transactionId: req.params.transactionId,
                actionId: req.params.actionId
            })({
                action: new cinerino.repository.Action(cinerino.mongoose.connection),
                transaction: new cinerino.repository.Transaction(cinerino.mongoose.connection)
            });

            res.status(NO_CONTENT).end();
        } catch (error) {
            next(error);
        }
    }
);
/**
 * 口座確保
 */
placeOrderTransactionsRouter.post(
    '/:transactionId/actions/authorize/paymentMethod/account',
    permitScopes(['aws.cognito.signin.user.admin', 'transactions']),
    ...[
        body('typeOf').not().isEmpty().withMessage((_, options) => `${options.path} is required`),
        body('amount').not().isEmpty().withMessage((_, options) => `${options.path} is required`).isInt(),
        body('additionalProperty').optional().isArray(),
        body('fromAccount').not().isEmpty().withMessage((_, options) => `${options.path} is required`)
    ],
    validator,
    rateLimit4transactionInProgress,
    async (req, res, next) => {
        try {
            let fromAccount: cinerino.factory.action.authorize.paymentMethod.account.IFromAccount<cinerino.factory.accountType>
                = req.body.fromAccount;
            // トークン化された口座情報に対応
            if (typeof fromAccount === 'string') {
                // tslint:disable-next-line:max-line-length
                type IPayload = cinerino.factory.ownershipInfo.IOwnershipInfo<cinerino.factory.ownershipInfo.IGood<cinerino.factory.ownershipInfo.AccountGoodType.Account>>;
                const accountOwnershipInfo = await cinerino.service.code.verifyToken<IPayload>({
                    agent: req.agent,
                    token: fromAccount,
                    secret: <string>process.env.TOKEN_SECRET,
                    issuer: <string>process.env.RESOURCE_SERVER_IDENTIFIER
                })({ action: new cinerino.repository.Action(cinerino.mongoose.connection) });
                const account = accountOwnershipInfo.typeOfGood;
                if (account.accountType !== cinerino.factory.accountType.Coin) {
                    throw new cinerino.factory.errors.Argument('fromAccount', 'Invalid token');
                }
                fromAccount = account;
            }
            // pecorino転送取引サービスクライアントを生成
            const transferService = new cinerino.pecorinoapi.service.transaction.Transfer({
                endpoint: <string>process.env.PECORINO_ENDPOINT,
                auth: pecorinoAuthClient
            });
            const action = await cinerino.service.transaction.placeOrderInProgress.action.authorize.paymentMethod.account.create({
                typeOf: cinerino.factory.paymentMethodType.Account,
                transactionId: req.params.transactionId,
                agentId: req.user.sub,
                amount: req.body.amount,
                additionalProperty: req.body.additionalProperty,
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
            res.status(CREATED).json(action);
        } catch (error) {
            next(error);
        }
    }
);
/**
 * 口座承認取消
 */
placeOrderTransactionsRouter.put(
    '/:transactionId/actions/authorize/paymentMethod/account/:actionId/cancel',
    permitScopes(['aws.cognito.signin.user.admin', 'transactions']),
    validator,
    rateLimit4transactionInProgress,
    async (req, res, next) => {
        try {
            const withdrawService = new cinerino.pecorinoapi.service.transaction.Withdraw({
                endpoint: <string>process.env.PECORINO_ENDPOINT,
                auth: pecorinoAuthClient
            });
            const transferService = new cinerino.pecorinoapi.service.transaction.Transfer({
                endpoint: <string>process.env.PECORINO_ENDPOINT,
                auth: pecorinoAuthClient
            });
            await cinerino.service.transaction.placeOrderInProgress.action.authorize.paymentMethod.account.cancel({
                agentId: req.user.sub,
                transactionId: req.params.transactionId,
                actionId: req.params.actionId
            })({
                action: new cinerino.repository.Action(cinerino.mongoose.connection),
                transaction: new cinerino.repository.Transaction(cinerino.mongoose.connection),
                transferTransactionService: transferService,
                withdrawTransactionService: withdrawService
            });
            res.status(NO_CONTENT).end();
        } catch (error) {
            next(error);
        }
    }
);
/**
 * ムビチケ承認
 */
placeOrderTransactionsRouter.post(
    '/:transactionId/actions/authorize/paymentMethod/movieTicket',
    permitScopes(['aws.cognito.signin.user.admin', 'transactions']),
    ...[
        body('typeOf').not().isEmpty().withMessage((_, options) => `${options.path} is required`),
        body('amount').not().isEmpty().withMessage((_, options) => `${options.path} is required`).isInt(),
        body('additionalProperty').optional().isArray(),
        body('movieTickets').not().isEmpty().withMessage((_, options) => `${options.path} is required`).isArray()
    ],
    validator,
    rateLimit4transactionInProgress,
    async (req, res, next) => {
        try {
            const action = await cinerino.service.transaction.placeOrderInProgress.action.authorize.paymentMethod.movieTicket.create({
                typeOf: cinerino.factory.paymentMethodType.MovieTicket,
                agentId: req.user.sub,
                amount: 0,
                additionalProperty: req.body.additionalProperty,
                transactionId: req.params.transactionId,
                movieTickets: req.body.movieTickets
            })({
                action: new cinerino.repository.Action(cinerino.mongoose.connection),
                event: new cinerino.repository.Event(cinerino.mongoose.connection),
                organization: new cinerino.repository.Organization(cinerino.mongoose.connection),
                transaction: new cinerino.repository.Transaction(cinerino.mongoose.connection),
                movieTicket: new cinerino.repository.paymentMethod.MovieTicket({
                    endpoint: <string>process.env.MVTK_RESERVE_ENDPOINT,
                    auth: mvtkReserveAuthClient
                })
            });
            res.status(CREATED).json(action);
        } catch (error) {
            next(error);
        }
    }
);
/**
 * ムビチケ承認取消
 */
placeOrderTransactionsRouter.put(
    '/:transactionId/actions/authorize/paymentMethod/movieTicket/:actionId/cancel',
    permitScopes(['aws.cognito.signin.user.admin', 'transactions']),
    validator,
    rateLimit4transactionInProgress,
    async (req, res, next) => {
        try {
            await cinerino.service.transaction.placeOrderInProgress.action.authorize.paymentMethod.movieTicket.cancel({
                agentId: req.user.sub,
                transactionId: req.params.transactionId,
                actionId: req.params.actionId
            })({
                action: new cinerino.repository.Action(cinerino.mongoose.connection),
                transaction: new cinerino.repository.Transaction(cinerino.mongoose.connection)
            });
            res.status(NO_CONTENT).end();
        } catch (error) {
            next(error);
        }
    }
);
/**
 * Mocoin口座確保
 */
placeOrderTransactionsRouter.post(
    '/:transactionId/actions/authorize/paymentMethod/mocoin',
    permitScopes(['aws.cognito.signin.user.admin', 'transactions']),
    ...[
        body('typeOf').not().isEmpty().withMessage((_, options) => `${options.path} is required`),
        body('amount').not().isEmpty().withMessage((_, options) => `${options.path} is required`).isInt(),
        body('additionalProperty').optional().isArray(),
        body('token').not().isEmpty().withMessage((_, options) => `${options.path} is required`),
        body('fromAccountNumber').not().isEmpty().withMessage((_, options) => `${options.path} is required`)
    ],
    validator,
    rateLimit4transactionInProgress,
    async (req, res, next) => {
        try {
            // mocoin転送取引サービスクライアントを生成
            const authClient = new cinerino.mocoin.auth.OAuth2({
                domain: <string>process.env.MOCOIN_AUTHORIZE_SERVER_DOMAIN,
                clientId: <string>process.env.MOCOIN_CLIENT_ID,
                clientSecret: <string>process.env.MOCOIN_CLIENT_SECRET,
                redirectUri: '',
                logoutUri: ''
            });
            authClient.setCredentials({ access_token: req.body.token });
            const transferService = new cinerino.mocoin.service.transaction.TransferCoin({
                endpoint: <string>process.env.MOCOIN_API_ENDPOINT,
                auth: authClient
            });
            const action = await cinerino.service.transaction.placeOrderInProgress.action.authorize.paymentMethod.mocoin.create({
                typeOf: cinerino.factory.paymentMethodType.Mocoin,
                transactionId: req.params.transactionId,
                agentId: req.user.sub,
                amount: req.body.amount,
                token: req.body.token,
                additionalProperty: req.body.additionalProperty,
                fromAccountNumber: req.body.fromAccountNumber,
                notes: req.body.notes
            })({
                action: new cinerino.repository.Action(cinerino.mongoose.connection),
                organization: new cinerino.repository.Organization(cinerino.mongoose.connection),
                transaction: new cinerino.repository.Transaction(cinerino.mongoose.connection),
                transferService: transferService
            });
            res.status(CREATED).json(action);
        } catch (error) {
            next(error);
        }
    }
);
/**
 * ポイントインセンティブ承認アクション
 */
placeOrderTransactionsRouter.post(
    '/:transactionId/actions/authorize/award/accounts/point',
    permitScopes(['aws.cognito.signin.user.admin', 'transactions']),
    (req, __2, next) => {
        req.checkBody('amount', 'invalid amount').notEmpty().withMessage('amount is required').isInt();
        req.checkBody('toAccountNumber', 'invalid toAccountNumber').notEmpty().withMessage('toAccountNumber is required');
        next();
    },
    validator,
    rateLimit4transactionInProgress,
    async (req, res, next) => {
        try {
            // pecorino転送取引サービスクライアントを生成
            const depositService = new cinerino.pecorinoapi.service.transaction.Deposit({
                endpoint: <string>process.env.PECORINO_ENDPOINT,
                auth: pecorinoAuthClient
            });
            const action = await cinerino.service.transaction.placeOrderInProgress.action.authorize.award.point.create({
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
            res.status(CREATED).json(action);
        } catch (error) {
            next(error);
        }
    }
);
/**
 * ポイントインセンティブ承認アクション取消
 */
placeOrderTransactionsRouter.put(
    '/:transactionId/actions/authorize/award/accounts/point/:actionId/cancel',
    permitScopes(['aws.cognito.signin.user.admin', 'transactions']),
    (__1, __2, next) => {
        next();
    },
    validator,
    rateLimit4transactionInProgress,
    async (req, res, next) => {
        try {
            const depositService = new cinerino.pecorinoapi.service.transaction.Deposit({
                endpoint: <string>process.env.PECORINO_ENDPOINT,
                auth: pecorinoAuthClient
            });
            await cinerino.service.transaction.placeOrderInProgress.action.authorize.award.point.cancel({
                agentId: req.user.sub,
                transactionId: req.params.transactionId,
                actionId: req.params.actionId
            })({
                action: new cinerino.repository.Action(cinerino.mongoose.connection),
                transaction: new cinerino.repository.Transaction(cinerino.mongoose.connection),
                depositTransactionService: depositService
            });
            res.status(NO_CONTENT).end();
        } catch (error) {
            next(error);
        }
    }
);
placeOrderTransactionsRouter.put(
    '/:transactionId/confirm',
    permitScopes(['aws.cognito.signin.user.admin', 'transactions']),
    validator,
    rateLimit4transactionInProgress,
    async (req, res, next) => {
        try {
            const orderDate = new Date();
            const result = await cinerino.service.transaction.placeOrderInProgress.confirm({
                agentId: req.user.sub,
                transactionId: req.params.transactionId,
                sendEmailMessage: (req.body.sendEmailMessage === true) ? true : false,
                orderDate: orderDate
            })({
                action: new cinerino.repository.Action(cinerino.mongoose.connection),
                transaction: new cinerino.repository.Transaction(cinerino.mongoose.connection),
                confirmationNumber: new cinerino.repository.ConfirmationNumber(redis.getClient()),
                orderNumber: new cinerino.repository.OrderNumber(redis.getClient()),
                organization: new cinerino.repository.Organization(cinerino.mongoose.connection)
            });
            debug('transaction confirmed');
            res.json(result);
        } catch (error) {
            next(error);
        }
    }
);
/**
 * 取引を明示的に中止
 */
placeOrderTransactionsRouter.put(
    '/:transactionId/cancel',
    permitScopes(['aws.cognito.signin.user.admin', 'transactions']),
    validator,
    async (req, res, next) => {
        try {
            const transactionRepo = new cinerino.repository.Transaction(cinerino.mongoose.connection);
            await transactionRepo.cancel({ typeOf: cinerino.factory.transactionType.PlaceOrder, id: req.params.transactionId });
            debug('transaction canceled.');
            res.status(NO_CONTENT).end();
        } catch (error) {
            next(error);
        }
    }
);
/**
 * 取引検索
 */
placeOrderTransactionsRouter.get(
    '',
    permitScopes(['admin']),
    validator,
    async (req, res, next) => {
        try {
            const transactionRepo = new cinerino.repository.Transaction(cinerino.mongoose.connection);
            const searchConditions: cinerino.factory.transaction.ISearchConditions<cinerino.factory.transactionType.PlaceOrder> = {
                // tslint:disable-next-line:no-magic-numbers
                limit: (req.query.limit !== undefined) ? Math.min(req.query.limit, 100) : 100,
                page: (req.query.page !== undefined) ? Math.max(req.query.page, 1) : 1,
                sort: (req.query.sort !== undefined) ? req.query.sort : { startDate: cinerino.factory.sortType.Ascending },
                typeOf: cinerino.factory.transactionType.PlaceOrder,
                ids: (Array.isArray(req.query.ids)) ? req.query.ids : undefined,
                statuses: (Array.isArray(req.query.statuses)) ? req.query.statuses : undefined,
                startFrom: (req.query.startFrom !== undefined) ? moment(req.query.startFrom).toDate() : undefined,
                startThrough: (req.query.startThrough !== undefined) ? moment(req.query.startThrough).toDate() : undefined,
                endFrom: (req.query.endFrom !== undefined) ? moment(req.query.endFrom).toDate() : undefined,
                endThrough: (req.query.endThrough !== undefined) ? moment(req.query.endThrough).toDate() : undefined,
                agent: req.query.agent,
                seller: req.query.seller,
                object: req.query.object,
                result: req.query.result
            };
            const transactions = await transactionRepo.search(searchConditions);
            const totalCount = await transactionRepo.count(searchConditions);
            res.set('X-Total-Count', totalCount.toString());
            res.json(transactions);
        } catch (error) {
            next(error);
        }
    }
);
/**
 * 取引に対するアクション検索
 */
placeOrderTransactionsRouter.get(
    '/:transactionId/actions',
    permitScopes(['admin']),
    validator,
    async (req, res, next) => {
        try {
            const actionRepo = new cinerino.repository.Action(cinerino.mongoose.connection);
            const actions = await actionRepo.searchByTransactionId({
                transactionType: cinerino.factory.transactionType.PlaceOrder,
                transactionId: req.params.transactionId,
                sort: req.query.sort
            });
            res.json(actions);
        } catch (error) {
            next(error);
        }
    }
);
/**
 * 取引レポート
 */
placeOrderTransactionsRouter.get(
    '/report',
    permitScopes(['admin']),
    validator,
    async (req, res, next) => {
        try {
            const transactionRepo = new cinerino.repository.Transaction(cinerino.mongoose.connection);
            const searchConditions: cinerino.factory.transaction.ISearchConditions<cinerino.factory.transactionType.PlaceOrder> = {
                limit: undefined,
                page: undefined,
                sort: (req.query.sort !== undefined) ? req.query.sort : { startDate: cinerino.factory.sortType.Ascending },
                typeOf: cinerino.factory.transactionType.PlaceOrder,
                ids: (Array.isArray(req.query.ids)) ? req.query.ids : undefined,
                statuses: (Array.isArray(req.query.statuses)) ? req.query.statuses : undefined,
                startFrom: (req.query.startFrom !== undefined) ? moment(req.query.startFrom).toDate() : undefined,
                startThrough: (req.query.startThrough !== undefined) ? moment(req.query.startThrough).toDate() : undefined,
                endFrom: (req.query.endFrom !== undefined) ? moment(req.query.endFrom).toDate() : undefined,
                endThrough: (req.query.endThrough !== undefined) ? moment(req.query.endThrough).toDate() : undefined,
                agent: req.query.agent,
                seller: req.query.seller,
                object: req.query.object,
                result: req.query.result
            };
            const stream = await cinerino.service.report.transaction.download({
                conditions: searchConditions,
                format: req.query.format
            })({ transaction: transactionRepo });
            res.type(`${req.query.format}; charset=utf-8`);
            stream.pipe(res);
        } catch (error) {
            next(error);
        }
    }
);
export default placeOrderTransactionsRouter;
