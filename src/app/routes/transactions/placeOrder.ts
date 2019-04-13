/**
 * 注文取引ルーター
 */
import * as cinerino from '@cinerino/domain';

import * as createDebug from 'debug';
import { Router } from 'express';
// tslint:disable-next-line:no-submodule-imports
import { body, query } from 'express-validator/check';
import { CREATED, NO_CONTENT } from 'http-status';
import * as moment from 'moment';
import * as mongoose from 'mongoose';

import authentication from '../../middlewares/authentication';
import permitScopes from '../../middlewares/permitScopes';
import rateLimit4transactionInProgress from '../../middlewares/rateLimit4transactionInProgress';
import validator from '../../middlewares/validator';

import placeOrder4cinemasunshineRouter from './placeOrder4cinemasunshine';

import * as redis from '../../../redis';

/**
 * GMOメンバーIDにユーザーネームを使用するかどうか
 */
const USE_USERNAME_AS_GMO_MEMBER_ID = process.env.USE_USERNAME_AS_GMO_MEMBER_ID === '1';

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

placeOrderTransactionsRouter.use(authentication);

// Cinemasunshine対応
placeOrderTransactionsRouter.use(placeOrder4cinemasunshineRouter);

placeOrderTransactionsRouter.post(
    '/start',
    permitScopes(['aws.cognito.signin.user.admin', 'transactions']),
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
    },
    (req, _, next) => {
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
    },
    validator,
    // tslint:disable-next-line:max-func-body-length
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

            const sellerRepo = new cinerino.repository.Seller(mongoose.connection);
            const transactionRepo = new cinerino.repository.Transaction(mongoose.connection);

            // パラメーターの形式をunix timestampからISO 8601フォーマットに変更したため、互換性を維持するように期限をセット
            const expires = (/^\d+$/.test(<string>req.body.expires))
                // tslint:disable-next-line:no-magic-numbers
                ? moment.unix(Number(<string>req.body.expires))
                    .toDate()
                : moment(<string>req.body.expires)
                    .toDate();

            const seller = await sellerRepo.findById({ id: <string>req.body.seller.id });

            const passportValidator: cinerino.service.transaction.placeOrderInProgress.IPassportValidator =
                (params) => {
                    // 許可証発行者確認
                    const validIssuer = params.passport.iss === process.env.WAITER_PASSPORT_ISSUER;

                    // スコープのフォーマットは、Transaction:PlaceOrder:${sellerId}
                    const newExplodedScopeStrings = params.passport.scope.split(':');
                    const newValidScope = (
                        newExplodedScopeStrings[0] === 'Transaction' && // スコープ接頭辞確認
                        newExplodedScopeStrings[1] === cinerino.factory.transactionType.PlaceOrder && // スコープ接頭辞確認
                        // tslint:disable-next-line:no-magic-numbers
                        newExplodedScopeStrings[2] === req.body.seller.id // 販売者識別子確認
                    );

                    // スコープのフォーマットは、placeOrderTransaction.${sellerIdentifier}
                    // cinemasunshine対応
                    const oldExplodedScopeStrings = params.passport.scope.split('.');
                    const oldValidScope = (
                        oldExplodedScopeStrings[0] === 'placeOrderTransaction' && // スコープ接頭辞確認
                        oldExplodedScopeStrings[1] === seller.identifier // 販売者識別子確認
                    );

                    // スコープスタイルは新旧どちらか一方有効であれok
                    const validScope = newValidScope || oldValidScope;

                    // クライアントの有効性
                    let validClient = true;
                    if (req.user.client_id !== undefined) {
                        if (Array.isArray(params.passport.aud) && params.passport.aud.indexOf(req.user.client_id) < 0) {
                            validClient = false;
                        }
                    }

                    return validIssuer && validScope && validClient;
                };

            const transaction = await cinerino.service.transaction.placeOrderInProgress.start({
                expires: expires,
                agent: {
                    ...req.agent,
                    identifier: [
                        ...(req.agent.identifier !== undefined) ? req.agent.identifier : [],
                        ...(req.body.agent !== undefined && req.body.agent.identifier !== undefined) ? req.body.agent.identifier : []
                    ]
                },
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
    ...[
        body('familyName')
            .not()
            .isEmpty()
            .withMessage((_, __) => 'required'),
        body('givenName')
            .not()
            .isEmpty()
            .withMessage((_, __) => 'required'),
        body('telephone')
            .not()
            .isEmpty()
            .withMessage((_, __) => 'required'),
        body('email')
            .not()
            .isEmpty()
            .withMessage((_, __) => 'required')
    ],
    validator,
    async (req, res, next) => {
        await rateLimit4transactionInProgress({
            typeOf: cinerino.factory.transactionType.PlaceOrder,
            id: req.params.transactionId
        })(req, res, next);
    },
    async (req, res, next) => {
        try {
            let requestedNumber = <string>req.body.telephone;

            try {
                // cinemasunshine対応として、国内向け電話番号フォーマットであれば、強制的に日本国番号を追加
                if (requestedNumber.slice(0, 1) === '0') {
                    requestedNumber = `+81${requestedNumber.slice(1)}`;
                }
            } catch (error) {
                throw new cinerino.factory.errors.Argument('Telephone', `Unexpected value: ${error.message}`);
            }

            const contact = await cinerino.service.transaction.placeOrderInProgress.updateCustomerProfile({
                id: req.params.transactionId,
                agent: {
                    id: req.user.sub,
                    familyName: <string>req.body.familyName,
                    givenName: <string>req.body.givenName,
                    email: <string>req.body.email,
                    telephone: requestedNumber
                }
            })({
                transaction: new cinerino.repository.Transaction(mongoose.connection)
            });

            // Cinemasunshine対応
            if (process.env.CUSTOMER_TELEPHONE_JP_FORMAT_ACCEPTED === '1') {
                res.status(CREATED)
                    .json(contact);
            } else {
                res.json(contact);
            }
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
    ...[
        body('object.acceptedOffer.additionalProperty')
            .optional()
            .isArray(),
        body('object.acceptedOffer.additionalProperty.*.name')
            .optional()
            .not()
            .isEmpty()
            .withMessage((_, __) => 'required')
            .isString(),
        body('object.acceptedOffer.additionalProperty.*.value')
            .optional()
            .not()
            .isEmpty()
            .withMessage((_, __) => 'required')
            .isString()
    ],
    validator,
    async (req, res, next) => {
        await rateLimit4transactionInProgress({
            typeOf: cinerino.factory.transactionType.PlaceOrder,
            id: req.params.transactionId
        })(req, res, next);
    },
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
                object: req.body,
                agent: { id: req.user.sub },
                transaction: { id: <string>req.params.transactionId }
            })({
                action: new cinerino.repository.Action(mongoose.connection),
                event: new cinerino.repository.Event(mongoose.connection),
                eventService: eventService,
                movieTicket: new cinerino.repository.paymentMethod.MovieTicket({
                    endpoint: <string>process.env.MVTK_RESERVE_ENDPOINT,
                    auth: mvtkReserveAuthClient
                }),
                seller: new cinerino.repository.Seller(mongoose.connection),
                reserveService: reserveService,
                transaction: new cinerino.repository.Transaction(mongoose.connection)
            });

            res.status(CREATED)
                .json(action);
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
    async (req, res, next) => {
        await rateLimit4transactionInProgress({
            typeOf: cinerino.factory.transactionType.PlaceOrder,
            id: req.params.transactionId
        })(req, res, next);
    },
    async (req, res, next) => {
        try {
            const reserveService = new cinerino.chevre.service.transaction.Reserve({
                endpoint: <string>process.env.CHEVRE_ENDPOINT,
                auth: chevreAuthClient
            });
            await cinerino.service.transaction.placeOrderInProgress.action.authorize.offer.seatReservation.cancel({
                agent: { id: req.user.sub },
                transaction: { id: req.params.transactionId },
                id: req.params.actionId
            })({
                action: new cinerino.repository.Action(mongoose.connection),
                transaction: new cinerino.repository.Transaction(mongoose.connection),
                reserveService: reserveService
            });

            res.status(NO_CONTENT)
                .end();
        } catch (error) {
            next(error);
        }
    }
);

/**
 * 汎用決済承認
 * @deprecated /payment
 */
placeOrderTransactionsRouter.post(
    '/:transactionId/actions/authorize/paymentMethod/any',
    permitScopes(['admin']),
    ...[
        body('typeOf')
            .not()
            .isEmpty()
            .withMessage((_, __) => 'required'),
        body('amount')
            .not()
            .isEmpty()
            .withMessage((_, __) => 'required')
            .isInt(),
        body('additionalProperty')
            .optional()
            .isArray()
    ],
    validator,
    async (req, res, next) => {
        await rateLimit4transactionInProgress({
            typeOf: cinerino.factory.transactionType.PlaceOrder,
            id: req.params.transactionId
        })(req, res, next);
    },
    async (req, res, next) => {
        try {
            const action = await cinerino.service.payment.any.authorize({
                agent: { id: req.user.sub },
                object: req.body,
                purpose: { typeOf: cinerino.factory.transactionType.PlaceOrder, id: req.params.transactionId }
            })({
                action: new cinerino.repository.Action(mongoose.connection),
                transaction: new cinerino.repository.Transaction(mongoose.connection),
                seller: new cinerino.repository.Seller(mongoose.connection)
            });
            res.status(CREATED)
                .json(action);
        } catch (error) {
            next(error);
        }
    }
);

/**
 * 汎用決済承認取消
 * @deprecated /payment
 */
placeOrderTransactionsRouter.put(
    '/:transactionId/actions/authorize/paymentMethod/any/:actionId/cancel',
    permitScopes(['admin']),
    validator,
    async (req, res, next) => {
        await rateLimit4transactionInProgress({
            typeOf: cinerino.factory.transactionType.PlaceOrder,
            id: req.params.transactionId
        })(req, res, next);
    },
    async (req, res, next) => {
        try {
            await cinerino.service.payment.any.voidTransaction({
                agent: { id: req.user.sub },
                id: req.params.actionId,
                purpose: { typeOf: cinerino.factory.transactionType.PlaceOrder, id: req.params.transactionId }
            })({
                action: new cinerino.repository.Action(mongoose.connection),
                transaction: new cinerino.repository.Transaction(mongoose.connection)
            });
            res.status(NO_CONTENT)
                .end();
        } catch (error) {
            next(error);
        }
    }
);

/**
 * クレジットカードオーソリ
 * @deprecated /payment
 */
placeOrderTransactionsRouter.post(
    '/:transactionId/actions/authorize/paymentMethod/creditCard',
    permitScopes(['aws.cognito.signin.user.admin', 'transactions']),
    ...[
        body('typeOf')
            .not()
            .isEmpty()
            .withMessage((_, __) => 'required'),
        body('amount')
            .not()
            .isEmpty()
            .withMessage((_, __) => 'required')
            .isInt(),
        body('additionalProperty')
            .optional()
            .isArray(),
        body('orderId')
            .optional()
            .isString()
            .withMessage((_, options) => `${options.path} must be string`)
            .isLength({ max: 27 }),
        body('method')
            .not()
            .isEmpty()
            .withMessage((_, __) => 'required'),
        body('creditCard')
            .not()
            .isEmpty()
            .withMessage((_, __) => 'required')
    ],
    validator,
    async (req, res, next) => {
        await rateLimit4transactionInProgress({
            typeOf: cinerino.factory.transactionType.PlaceOrder,
            id: req.params.transactionId
        })(req, res, next);
    },
    async (req, res, next) => {
        try {
            // 会員IDを強制的にログイン中の人物IDに変更
            type ICreditCard4authorizeAction = cinerino.factory.action.authorize.paymentMethod.creditCard.ICreditCard;
            const memberId = (USE_USERNAME_AS_GMO_MEMBER_ID) ? <string>req.user.username : req.user.sub;
            const creditCard: ICreditCard4authorizeAction = {
                ...req.body.creditCard,
                memberId: memberId
            };
            debug('authorizing credit card...', creditCard);

            debug('authorizing credit card...', req.body.creditCard);
            const action = await cinerino.service.payment.creditCard.authorize({
                project: {
                    id: <string>process.env.PROJECT_ID,
                    gmoInfo: {
                        siteId: <string>process.env.GMO_SITE_ID,
                        sitePass: <string>process.env.GMO_SITE_PASS
                    }
                },
                agent: { id: req.user.sub },
                object: {
                    typeOf: cinerino.factory.paymentMethodType.CreditCard,
                    additionalProperty: req.body.additionalProperty,
                    orderId: req.body.orderId,
                    amount: req.body.amount,
                    method: req.body.method,
                    creditCard: creditCard
                },
                purpose: { typeOf: cinerino.factory.transactionType.PlaceOrder, id: req.params.transactionId }
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
            res.status(CREATED)
                .json(action);
        } catch (error) {
            next(error);
        }
    }
);

/**
 * クレジットカードオーソリ取消
 * @deprecated /payment
 */
placeOrderTransactionsRouter.put(
    '/:transactionId/actions/authorize/paymentMethod/creditCard/:actionId/cancel',
    permitScopes(['aws.cognito.signin.user.admin', 'transactions']),
    validator,
    async (req, res, next) => {
        await rateLimit4transactionInProgress({
            typeOf: cinerino.factory.transactionType.PlaceOrder,
            id: req.params.transactionId
        })(req, res, next);
    },
    async (req, res, next) => {
        try {
            await cinerino.service.payment.creditCard.voidTransaction({
                id: req.params.actionId,
                agent: { id: req.user.sub },
                purpose: { typeOf: cinerino.factory.transactionType.PlaceOrder, id: req.params.transactionId }
            })({
                action: new cinerino.repository.Action(mongoose.connection),
                transaction: new cinerino.repository.Transaction(mongoose.connection)
            });

            res.status(NO_CONTENT)
                .end();
        } catch (error) {
            next(error);
        }
    }
);

/**
 * 口座確保
 * @deprecated /payment
 */
placeOrderTransactionsRouter.post(
    '/:transactionId/actions/authorize/paymentMethod/account',
    permitScopes(['aws.cognito.signin.user.admin', 'transactions']),
    ...[
        body('typeOf')
            .not()
            .isEmpty()
            .withMessage((_, __) => 'required'),
        body('amount')
            .not()
            .isEmpty()
            .withMessage((_, __) => 'required')
            .isInt(),
        body('additionalProperty')
            .optional()
            .isArray(),
        body('fromAccount')
            .not()
            .isEmpty()
            .withMessage((_, __) => 'required')
    ],
    validator,
    async (req, res, next) => {
        await rateLimit4transactionInProgress({
            typeOf: cinerino.factory.transactionType.PlaceOrder,
            id: req.params.transactionId
        })(req, res, next);
    },
    async (req, res, next) => {
        try {
            let fromAccount: cinerino.factory.action.authorize.paymentMethod.account.IFromAccount<cinerino.factory.accountType>
                = req.body.fromAccount;
            let toAccount: cinerino.factory.action.authorize.paymentMethod.account.IToAccount<cinerino.factory.accountType> | undefined
                = req.body.toAccount;

            // トークン化された口座情報に対応
            if (typeof fromAccount === 'string') {
                // tslint:disable-next-line:max-line-length
                type IPayload = cinerino.factory.ownershipInfo.IOwnershipInfo<cinerino.factory.ownershipInfo.IGood<cinerino.factory.ownershipInfo.AccountGoodType.Account>>;
                const accountOwnershipInfo = await cinerino.service.code.verifyToken<IPayload>({
                    agent: req.agent,
                    token: fromAccount,
                    secret: <string>process.env.TOKEN_SECRET,
                    issuer: <string>process.env.RESOURCE_SERVER_IDENTIFIER
                })({ action: new cinerino.repository.Action(mongoose.connection) });
                const account = accountOwnershipInfo.typeOfGood;
                if (account.accountType !== cinerino.factory.accountType.Coin) {
                    throw new cinerino.factory.errors.Argument('fromAccount', 'Invalid token');
                }
                fromAccount = account;
            }

            const accountType = fromAccount.accountType;

            // pecorino転送取引サービスクライアントを生成
            const transferService = new cinerino.pecorinoapi.service.transaction.Transfer({
                endpoint: <string>process.env.PECORINO_ENDPOINT,
                auth: pecorinoAuthClient
            });

            const actionRepo = new cinerino.repository.Action(mongoose.connection);
            const sellerRepo = new cinerino.repository.Seller(mongoose.connection);
            const transactionRepo = new cinerino.repository.Transaction(mongoose.connection);

            // 注文取引の場合、販売者の口座を検索して、toAccountにセット
            const transaction = await transactionRepo.findById({
                typeOf: cinerino.factory.transactionType.PlaceOrder,
                id: req.params.transactionId
            });
            const seller = await sellerRepo.findById({
                id: transaction.seller.id
            });

            if (seller.paymentAccepted === undefined) {
                throw new cinerino.factory.errors.Argument('object', 'Pecorino payment not accepted.');
            }
            const accountPaymentsAccepted = <cinerino.factory.seller.IPaymentAccepted<cinerino.factory.paymentMethodType.Account>[]>
                seller.paymentAccepted.filter((a) => a.paymentMethodType === cinerino.factory.paymentMethodType.Account);
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

            const currency = (accountType === cinerino.factory.accountType.Coin)
                ? cinerino.factory.priceCurrency.JPY
                : accountType;
            const action = await cinerino.service.payment.account.authorize({
                agent: { id: req.user.sub },
                object: {
                    typeOf: cinerino.factory.paymentMethodType.Account,
                    amount: Number(req.body.amount),
                    currency: currency,
                    additionalProperty: req.body.additionalProperty,
                    fromAccount: fromAccount,
                    toAccount: toAccount,
                    notes: req.body.notes
                },
                purpose: { typeOf: cinerino.factory.transactionType.PlaceOrder, id: req.params.transactionId }
            })({
                action: actionRepo,
                transaction: transactionRepo,
                transferTransactionService: transferService
            });

            res.status(CREATED)
                .json(action);
        } catch (error) {
            next(error);
        }
    }
);

/**
 * 口座承認取消
 * @deprecated /payment
 */
placeOrderTransactionsRouter.put(
    '/:transactionId/actions/authorize/paymentMethod/account/:actionId/cancel',
    permitScopes(['aws.cognito.signin.user.admin', 'transactions']),
    validator,
    async (req, res, next) => {
        await rateLimit4transactionInProgress({
            typeOf: cinerino.factory.transactionType.PlaceOrder,
            id: req.params.transactionId
        })(req, res, next);
    },
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
            await cinerino.service.payment.account.voidTransaction({
                agent: { id: req.user.sub },
                id: req.params.actionId,
                purpose: { typeOf: cinerino.factory.transactionType.PlaceOrder, id: req.params.transactionId }
            })({
                action: new cinerino.repository.Action(mongoose.connection),
                transaction: new cinerino.repository.Transaction(mongoose.connection),
                transferTransactionService: transferService,
                withdrawTransactionService: withdrawService
            });
            res.status(NO_CONTENT)
                .end();
        } catch (error) {
            next(error);
        }
    }
);

/**
 * ムビチケ承認
 * @deprecated /payment
 */
placeOrderTransactionsRouter.post(
    '/:transactionId/actions/authorize/paymentMethod/movieTicket',
    permitScopes(['aws.cognito.signin.user.admin', 'transactions']),
    ...[
        body('typeOf')
            .not()
            .isEmpty()
            .withMessage((_, __) => 'required'),
        body('amount')
            .not()
            .isEmpty()
            .withMessage((_, __) => 'required')
            .isInt(),
        body('additionalProperty')
            .optional()
            .isArray(),
        body('movieTickets')
            .not()
            .isEmpty()
            .withMessage((_, __) => 'required')
            .isArray()
    ],
    validator,
    async (req, res, next) => {
        await rateLimit4transactionInProgress({
            typeOf: cinerino.factory.transactionType.PlaceOrder,
            id: req.params.transactionId
        })(req, res, next);
    },
    async (req, res, next) => {
        try {
            const action = await cinerino.service.payment.movieTicket.authorize({
                agent: { id: req.user.sub },
                object: {
                    typeOf: cinerino.factory.paymentMethodType.MovieTicket,
                    amount: 0,
                    additionalProperty: req.body.additionalProperty,
                    movieTickets: req.body.movieTickets
                },
                purpose: { typeOf: cinerino.factory.transactionType.PlaceOrder, id: req.params.transactionId }
            })({
                action: new cinerino.repository.Action(mongoose.connection),
                event: new cinerino.repository.Event(mongoose.connection),
                seller: new cinerino.repository.Seller(mongoose.connection),
                transaction: new cinerino.repository.Transaction(mongoose.connection),
                movieTicket: new cinerino.repository.paymentMethod.MovieTicket({
                    endpoint: <string>process.env.MVTK_RESERVE_ENDPOINT,
                    auth: mvtkReserveAuthClient
                })
            });
            res.status(CREATED)
                .json(action);
        } catch (error) {
            next(error);
        }
    }
);

/**
 * ムビチケ承認取消
 * @deprecated /payment
 */
placeOrderTransactionsRouter.put(
    '/:transactionId/actions/authorize/paymentMethod/movieTicket/:actionId/cancel',
    permitScopes(['aws.cognito.signin.user.admin', 'transactions']),
    validator,
    async (req, res, next) => {
        await rateLimit4transactionInProgress({
            typeOf: cinerino.factory.transactionType.PlaceOrder,
            id: req.params.transactionId
        })(req, res, next);
    },
    async (req, res, next) => {
        try {
            await cinerino.service.payment.movieTicket.voidTransaction({
                id: req.params.actionId,
                agent: { id: req.user.sub },
                purpose: { typeOf: cinerino.factory.transactionType.PlaceOrder, id: req.params.transactionId }
            })({
                action: new cinerino.repository.Action(mongoose.connection),
                transaction: new cinerino.repository.Transaction(mongoose.connection)
            });
            res.status(NO_CONTENT)
                .end();
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
        req.checkBody('amount', 'invalid amount')
            .notEmpty()
            .withMessage('amount is required')
            .isInt()
            .toInt();
        req.checkBody('toAccountNumber', 'invalid toAccountNumber')
            .notEmpty()
            .withMessage('toAccountNumber is required');
        next();
    },
    validator,
    async (req, res, next) => {
        await rateLimit4transactionInProgress({
            typeOf: cinerino.factory.transactionType.PlaceOrder,
            id: req.params.transactionId
        })(req, res, next);
    },
    async (req, res, next) => {
        try {
            // pecorino転送取引サービスクライアントを生成
            const depositService = new cinerino.pecorinoapi.service.transaction.Deposit({
                endpoint: <string>process.env.PECORINO_ENDPOINT,
                auth: pecorinoAuthClient
            });
            const action = await cinerino.service.transaction.placeOrderInProgress.action.authorize.award.point.create({
                transaction: { id: req.params.transactionId },
                agent: { id: req.user.sub },
                object: req.body
            })({
                action: new cinerino.repository.Action(mongoose.connection),
                transaction: new cinerino.repository.Transaction(mongoose.connection),
                ownershipInfo: new cinerino.repository.OwnershipInfo(mongoose.connection),
                depositTransactionService: depositService
            });
            res.status(CREATED)
                .json(action);
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
    async (req, res, next) => {
        await rateLimit4transactionInProgress({
            typeOf: cinerino.factory.transactionType.PlaceOrder,
            id: req.params.transactionId
        })(req, res, next);
    },
    async (req, res, next) => {
        try {
            const depositService = new cinerino.pecorinoapi.service.transaction.Deposit({
                endpoint: <string>process.env.PECORINO_ENDPOINT,
                auth: pecorinoAuthClient
            });
            await cinerino.service.transaction.placeOrderInProgress.action.authorize.award.point.cancel({
                agent: { id: req.user.sub },
                transaction: { id: req.params.transactionId },
                id: req.params.actionId
            })({
                action: new cinerino.repository.Action(mongoose.connection),
                transaction: new cinerino.repository.Transaction(mongoose.connection),
                depositTransactionService: depositService
            });
            res.status(NO_CONTENT)
                .end();
        } catch (error) {
            next(error);
        }
    }
);

placeOrderTransactionsRouter.put(
    '/:transactionId/confirm',
    permitScopes(['aws.cognito.signin.user.admin', 'transactions']),
    validator,
    async (req, res, next) => {
        await rateLimit4transactionInProgress({
            typeOf: cinerino.factory.transactionType.PlaceOrder,
            id: req.params.transactionId
        })(req, res, next);
    },
    async (req, res, next) => {
        try {
            const orderDate = new Date();

            const actionRepo = new cinerino.repository.Action(mongoose.connection);
            const transactionRepo = new cinerino.repository.Transaction(mongoose.connection);
            const confirmationNumberRepo = new cinerino.repository.ConfirmationNumber(redis.getClient());
            const orderNumberRepo = new cinerino.repository.OrderNumber(redis.getClient());
            const sellerRepo = new cinerino.repository.Seller(mongoose.connection);
            const taskRepo = new cinerino.repository.Task(mongoose.connection);

            const result = await cinerino.service.transaction.placeOrderInProgress.confirm({
                id: req.params.transactionId,
                agent: { id: req.user.sub },
                result: { order: { orderDate: orderDate } },
                options: {
                    ...req.body,
                    sendEmailMessage: (req.body.sendEmailMessage === true) ? true : false,
                    validateMovieTicket: (process.env.VALIDATE_MOVIE_TICKET === '1')
                }
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
            const taskRepo = new cinerino.repository.Task(mongoose.connection);
            const transactionRepo = new cinerino.repository.Transaction(mongoose.connection);
            await transactionRepo.cancel({
                typeOf: cinerino.factory.transactionType.PlaceOrder,
                id: <string>req.params.transactionId
            });

            // 非同期でタスクエクスポート(APIレスポンスタイムに影響を与えないように)
            // tslint:disable-next-line:no-floating-promises
            cinerino.service.transaction.placeOrder.exportTasks(cinerino.factory.transactionStatusType.Canceled)({
                task: taskRepo,
                transaction: transactionRepo
            });

            res.status(NO_CONTENT)
                .end();
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
    ...[
        query('startFrom')
            .optional()
            .isISO8601()
            .toDate(),
        query('startThrough')
            .optional()
            .isISO8601()
            .toDate(),
        query('endFrom')
            .optional()
            .isISO8601()
            .toDate(),
        query('endThrough')
            .optional()
            .isISO8601()
            .toDate()
    ],
    validator,
    async (req, res, next) => {
        try {
            const transactionRepo = new cinerino.repository.Transaction(mongoose.connection);
            const searchConditions: cinerino.factory.transaction.ISearchConditions<cinerino.factory.transactionType.PlaceOrder> = {
                ...req.query,
                // tslint:disable-next-line:no-magic-numbers
                limit: (req.query.limit !== undefined) ? Math.min(req.query.limit, 100) : 100,
                page: (req.query.page !== undefined) ? Math.max(req.query.page, 1) : 1,
                typeOf: cinerino.factory.transactionType.PlaceOrder
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
            const actionRepo = new cinerino.repository.Action(mongoose.connection);
            const actions = await actionRepo.searchByPurpose({
                purpose: {
                    typeOf: cinerino.factory.transactionType.PlaceOrder,
                    id: <string>req.params.transactionId
                },
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
            const transactionRepo = new cinerino.repository.Transaction(mongoose.connection);
            const searchConditions: cinerino.factory.transaction.ISearchConditions<cinerino.factory.transactionType.PlaceOrder> = {
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

            const format = req.query.format;

            const stream = await cinerino.service.report.transaction.stream({
                conditions: searchConditions,
                format: format
            })({ transaction: transactionRepo });

            res.type(`${req.query.format}; charset=utf-8`);
            stream.pipe(res);
        } catch (error) {
            next(error);
        }
    }
);

export default placeOrderTransactionsRouter;
