/**
 * 注文取引ルーター
 */
import * as cinerino from '@cinerino/domain';

import * as createDebug from 'debug';
import { Router } from 'express';
// tslint:disable-next-line:no-implicit-dependencies
import { ParamsDictionary } from 'express-serve-static-core';
// tslint:disable-next-line:no-submodule-imports
import { body, query } from 'express-validator/check';
import { CREATED, NO_CONTENT } from 'http-status';
import * as moment from 'moment';
import * as mongoose from 'mongoose';

import authentication from '../../middlewares/authentication';
import lockTransaction from '../../middlewares/lockTransaction';
import permitScopes from '../../middlewares/permitScopes';
import rateLimit from '../../middlewares/rateLimit';
import rateLimit4transactionInProgress from '../../middlewares/rateLimit4transactionInProgress';
import validator from '../../middlewares/validator';

import placeOrder4cinemasunshineRouter from './placeOrder4cinemasunshine';

import * as redis from '../../../redis';

const MULTI_TENANT_SUPPORTED = process.env.MULTI_TENANT_SUPPORTED === '1';
const USE_EVENT_REPO = process.env.USE_EVENT_REPO === '1';

/**
 * GMOメンバーIDにユーザーネームを使用するかどうか
 */
const USE_USERNAME_AS_GMO_MEMBER_ID = process.env.USE_USERNAME_AS_GMO_MEMBER_ID === '1';
const WAITER_DISABLED = process.env.WAITER_DISABLED === '1';
const NUM_ORDER_ITEMS_MAX_VALUE = (process.env.NUM_ORDER_ITEMS_MAX_VALUE !== undefined)
    ? Number(process.env.NUM_ORDER_ITEMS_MAX_VALUE)
    // tslint:disable-next-line:no-magic-numbers
    : 50;

const placeOrderTransactionsRouter = Router();
const debug = createDebug('cinerino-api:router');

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
    permitScopes(['customer', 'transactions', 'pos']),
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
    ...[
        body('expires')
            .not()
            .isEmpty()
            .withMessage((_, __) => 'required')
            .isISO8601()
            .toDate(),
        body('agent.identifier')
            .optional()
            .isArray({ max: 10 }),
        body('agent.identifier.*.name')
            .optional()
            .not()
            .isEmpty()
            .isString()
            .isLength({ max: 256 }),
        body('agent.identifier.*.value')
            .optional()
            .not()
            .isEmpty()
            .isString()
            .isLength({ max: 512 }),
        body('seller.typeOf')
            .not()
            .isEmpty()
            .withMessage((_, __) => 'required'),
        body('seller.id')
            .not()
            .isEmpty()
            .withMessage((_, __) => 'required'),
        ...(!WAITER_DISABLED)
            ? [
                body('object.passport.token')
                    .not()
                    .isEmpty()
                    .withMessage((_, __) => 'required')
            ]
            : []

    ],
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

            const projectRepo = new cinerino.repository.Project(mongoose.connection);
            const sellerRepo = new cinerino.repository.Seller(mongoose.connection);
            const transactionRepo = new cinerino.repository.Transaction(mongoose.connection);

            const expires: Date = req.body.expires;

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
                project: req.project,
                expires: expires,
                agent: {
                    ...req.agent,
                    identifier: [
                        ...(req.agent.identifier !== undefined) ? req.agent.identifier : [],
                        ...(req.body.agent !== undefined && Array.isArray(req.body.agent.identifier))
                            ? (<any[]>req.body.agent.identifier).map((p: any) => {
                                return { name: String(p.name), value: String(p.value) };
                            })
                            : []
                    ]
                },
                seller: req.body.seller,
                object: {
                    passport: passport,
                    ...{
                        clientUser: req.user
                    }
                },
                passportValidator: passportValidator
            })({
                project: projectRepo,
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
// tslint:disable-next-line:use-default-type-parameter
placeOrderTransactionsRouter.put<ParamsDictionary>(
    '/:transactionId/customerContact',
    permitScopes(['customer', 'transactions', 'pos']),
    ...[
        body('additionalProperty')
            .optional()
            .isArray({ max: 10 }),
        body('additionalProperty.*.name')
            .optional()
            .not()
            .isEmpty()
            .isString()
            .isLength({ max: 256 }),
        body('additionalProperty.*.value')
            .optional()
            .not()
            .isEmpty()
            .isString()
            .isLength({ max: 512 }),
        body('email')
            .not()
            .isEmpty()
            .withMessage((_, __) => 'required'),
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
        await lockTransaction({
            typeOf: cinerino.factory.transactionType.PlaceOrder,
            id: req.params.transactionId
        })(req, res, next);
    },
    async (req, res, next) => {
        try {
            let requestedNumber = String(req.body.telephone);

            try {
                // cinemasunshine対応として、国内向け電話番号フォーマットであれば、強制的に日本国番号を追加
                if (requestedNumber.slice(0, 1) === '0' && typeof req.body.telephoneRegion !== 'string') {
                    requestedNumber = `+81${requestedNumber.slice(1)}`;
                }
            } catch (error) {
                throw new cinerino.factory.errors.Argument('Telephone', `Unexpected value: ${error.message}`);
            }

            const profile = await cinerino.service.transaction.placeOrderInProgress.updateAgent({
                id: req.params.transactionId,
                agent: {
                    ...req.body,
                    typeOf: cinerino.factory.personType.Person,
                    id: req.user.sub,
                    telephone: requestedNumber
                }
            })({
                transaction: new cinerino.repository.Transaction(mongoose.connection)
            });

            res.json(profile);
        } catch (error) {
            next(error);
        }
    }
);

/**
 * 座席仮予約
 */
// tslint:disable-next-line:use-default-type-parameter
placeOrderTransactionsRouter.post<ParamsDictionary>(
    '/:transactionId/actions/authorize/offer/seatReservation',
    permitScopes(['customer', 'transactions']),
    ...[
        body('object.acceptedOffer.additionalProperty')
            .optional()
            .isArray({ max: 10 }),
        body('object.acceptedOffer.additionalProperty.*.name')
            .optional()
            .not()
            .isEmpty()
            .isString()
            .isLength({ max: 256 }),
        body('object.acceptedOffer.additionalProperty.*.value')
            .optional()
            .not()
            .isEmpty()
            .isString()
            .isLength({ max: 512 })
    ],
    validator,
    async (req, res, next) => {
        await rateLimit4transactionInProgress({
            typeOf: cinerino.factory.transactionType.PlaceOrder,
            id: req.params.transactionId
        })(req, res, next);
    },
    async (req, res, next) => {
        await lockTransaction({
            typeOf: cinerino.factory.transactionType.PlaceOrder,
            id: req.params.transactionId
        })(req, res, next);
    },
    async (req, res, next) => {
        try {
            const projectRepo = new cinerino.repository.Project(mongoose.connection);
            const project = await projectRepo.findById({ id: req.project.id });
            if (project.settings === undefined) {
                throw new cinerino.factory.errors.ServiceUnavailable('Project settings undefined');
            }
            if (project.settings.mvtkReserve === undefined) {
                throw new cinerino.factory.errors.ServiceUnavailable('Project settings not found');
            }

            const action = await cinerino.service.transaction.placeOrderInProgress.action.authorize.offer.seatReservation.create({
                project: req.project,
                object: {
                    ...req.body
                },
                agent: { id: req.user.sub },
                transaction: { id: req.params.transactionId }
            })({
                action: new cinerino.repository.Action(mongoose.connection),
                movieTicket: new cinerino.repository.paymentMethod.MovieTicket({
                    endpoint: project.settings.mvtkReserve.endpoint,
                    auth: mvtkReserveAuthClient
                }),
                project: projectRepo,
                seller: new cinerino.repository.Seller(mongoose.connection),
                transaction: new cinerino.repository.Transaction(mongoose.connection),
                ...(USE_EVENT_REPO) ? { event: new cinerino.repository.Event(mongoose.connection) } : undefined
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
// tslint:disable-next-line:use-default-type-parameter
placeOrderTransactionsRouter.put<ParamsDictionary>(
    '/:transactionId/actions/authorize/offer/seatReservation/:actionId/cancel',
    permitScopes(['customer', 'transactions']),
    validator,
    async (req, res, next) => {
        await rateLimit4transactionInProgress({
            typeOf: cinerino.factory.transactionType.PlaceOrder,
            id: req.params.transactionId
        })(req, res, next);
    },
    async (req, res, next) => {
        await lockTransaction({
            typeOf: cinerino.factory.transactionType.PlaceOrder,
            id: req.params.transactionId
        })(req, res, next);
    },
    async (req, res, next) => {
        try {
            await cinerino.service.transaction.placeOrderInProgress.action.authorize.offer.seatReservation.cancel({
                project: req.project,
                agent: { id: req.user.sub },
                transaction: { id: req.params.transactionId },
                id: req.params.actionId
            })({
                action: new cinerino.repository.Action(mongoose.connection),
                project: new cinerino.repository.Project(mongoose.connection),
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
 * 汎用決済承認
 * @deprecated /payment
 */
// tslint:disable-next-line:use-default-type-parameter
placeOrderTransactionsRouter.post<ParamsDictionary>(
    '/:transactionId/actions/authorize/paymentMethod/any',
    permitScopes([]),
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
            .isArray({ max: 10 }),
        body('additionalProperty.*.name')
            .optional()
            .not()
            .isEmpty()
            .isString()
            .isLength({ max: 256 }),
        body('additionalProperty.*.value')
            .optional()
            .not()
            .isEmpty()
            // バリデーション強化前の数字リクエストに対する互換性維持のため
            .customSanitizer((value) => typeof value === 'number' ? String(value) : value)
            .isString()
            .isLength({ max: 512 })
    ],
    validator,
    async (req, res, next) => {
        await rateLimit4transactionInProgress({
            typeOf: cinerino.factory.transactionType.PlaceOrder,
            id: req.params.transactionId
        })(req, res, next);
    },
    async (req, res, next) => {
        await lockTransaction({
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
// tslint:disable-next-line:use-default-type-parameter
placeOrderTransactionsRouter.put<ParamsDictionary>(
    '/:transactionId/actions/authorize/paymentMethod/any/:actionId/cancel',
    permitScopes([]),
    validator,
    async (req, res, next) => {
        await rateLimit4transactionInProgress({
            typeOf: cinerino.factory.transactionType.PlaceOrder,
            id: req.params.transactionId
        })(req, res, next);
    },
    async (req, res, next) => {
        await lockTransaction({
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
// tslint:disable-next-line:use-default-type-parameter
placeOrderTransactionsRouter.post<ParamsDictionary>(
    '/:transactionId/actions/authorize/paymentMethod/creditCard',
    permitScopes(['customer', 'transactions']),
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
            .isArray({ max: 10 }),
        body('additionalProperty.*.name')
            .optional()
            .not()
            .isEmpty()
            .isString()
            .isLength({ max: 256 }),
        body('additionalProperty.*.value')
            .optional()
            .not()
            .isEmpty()
            .isString()
            .isLength({ max: 512 }),
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
        await lockTransaction({
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
                project: req.project,
                agent: { id: req.user.sub },
                object: {
                    typeOf: cinerino.factory.paymentMethodType.CreditCard,
                    additionalProperty: (Array.isArray(req.body.additionalProperty))
                        ? (<any[]>req.body.additionalProperty).map((p: any) => {
                            return { name: String(p.name), value: String(p.value) };
                        })
                        : [],
                    amount: req.body.amount,
                    method: req.body.method,
                    creditCard: creditCard,
                    ...(typeof req.body.orderId === 'string') ? { orderId: <string>req.body.orderId } : undefined
                },
                purpose: { typeOf: cinerino.factory.transactionType.PlaceOrder, id: req.params.transactionId }
            })({
                action: new cinerino.repository.Action(mongoose.connection),
                project: new cinerino.repository.Project(mongoose.connection),
                transaction: new cinerino.repository.Transaction(mongoose.connection),
                seller: new cinerino.repository.Seller(mongoose.connection)
            });

            res.status(CREATED)
                .json({
                    ...action,
                    result: undefined
                });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * クレジットカードオーソリ取消
 * @deprecated /payment
 */
// tslint:disable-next-line:use-default-type-parameter
placeOrderTransactionsRouter.put<ParamsDictionary>(
    '/:transactionId/actions/authorize/paymentMethod/creditCard/:actionId/cancel',
    permitScopes(['customer', 'transactions']),
    validator,
    async (req, res, next) => {
        await rateLimit4transactionInProgress({
            typeOf: cinerino.factory.transactionType.PlaceOrder,
            id: req.params.transactionId
        })(req, res, next);
    },
    async (req, res, next) => {
        await lockTransaction({
            typeOf: cinerino.factory.transactionType.PlaceOrder,
            id: req.params.transactionId
        })(req, res, next);
    },
    async (req, res, next) => {
        try {
            await cinerino.service.payment.creditCard.voidTransaction({
                project: { id: req.project.id },
                id: req.params.actionId,
                agent: { id: req.user.sub },
                purpose: { typeOf: cinerino.factory.transactionType.PlaceOrder, id: req.params.transactionId }
            })({
                action: new cinerino.repository.Action(mongoose.connection),
                project: new cinerino.repository.Project(mongoose.connection),
                seller: new cinerino.repository.Seller(mongoose.connection),
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
// tslint:disable-next-line:use-default-type-parameter
placeOrderTransactionsRouter.post<ParamsDictionary>(
    '/:transactionId/actions/authorize/paymentMethod/account',
    permitScopes(['customer', 'transactions']),
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
            .isArray({ max: 10 }),
        body('additionalProperty.*.name')
            .optional()
            .not()
            .isEmpty()
            .isString()
            .isLength({ max: 256 }),
        body('additionalProperty.*.value')
            .optional()
            .not()
            .isEmpty()
            .isString()
            .isLength({ max: 512 }),
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
        await lockTransaction({
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
                    project: req.project,
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

            const actionRepo = new cinerino.repository.Action(mongoose.connection);
            const projectRepo = new cinerino.repository.Project(mongoose.connection);
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
                project: req.project,
                agent: { id: req.user.sub },
                object: {
                    typeOf: cinerino.factory.paymentMethodType.Account,
                    amount: Number(req.body.amount),
                    currency: currency,
                    additionalProperty: (Array.isArray(req.body.additionalProperty))
                        ? (<any[]>req.body.additionalProperty).map((p: any) => {
                            return { name: String(p.name), value: String(p.value) };
                        })
                        : [],
                    fromAccount: fromAccount,
                    toAccount: toAccount,
                    notes: req.body.notes
                },
                purpose: { typeOf: cinerino.factory.transactionType.PlaceOrder, id: req.params.transactionId }
            })({
                action: actionRepo,
                project: projectRepo,
                transaction: transactionRepo
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
// tslint:disable-next-line:use-default-type-parameter
placeOrderTransactionsRouter.put<ParamsDictionary>(
    '/:transactionId/actions/authorize/paymentMethod/account/:actionId/cancel',
    permitScopes(['customer', 'transactions']),
    validator,
    async (req, res, next) => {
        await rateLimit4transactionInProgress({
            typeOf: cinerino.factory.transactionType.PlaceOrder,
            id: req.params.transactionId
        })(req, res, next);
    },
    async (req, res, next) => {
        await lockTransaction({
            typeOf: cinerino.factory.transactionType.PlaceOrder,
            id: req.params.transactionId
        })(req, res, next);
    },
    async (req, res, next) => {
        try {
            await cinerino.service.payment.account.voidTransaction({
                project: req.project,
                agent: { id: req.user.sub },
                id: req.params.actionId,
                purpose: { typeOf: cinerino.factory.transactionType.PlaceOrder, id: req.params.transactionId }
            })({
                action: new cinerino.repository.Action(mongoose.connection),
                project: new cinerino.repository.Project(mongoose.connection),
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
 * ムビチケ承認
 * @deprecated /payment
 */
// tslint:disable-next-line:use-default-type-parameter
placeOrderTransactionsRouter.post<ParamsDictionary>(
    '/:transactionId/actions/authorize/paymentMethod/movieTicket',
    permitScopes(['customer', 'transactions']),
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
            .isArray({ max: 10 }),
        body('additionalProperty.*.name')
            .optional()
            .not()
            .isEmpty()
            .isString()
            .isLength({ max: 256 }),
        body('additionalProperty.*.value')
            .optional()
            .not()
            .isEmpty()
            .isString()
            .isLength({ max: 512 }),
        body('movieTickets')
            .not()
            .isEmpty()
            .withMessage((_, __) => 'required')
            .isArray({ max: 20 })
    ],
    validator,
    async (req, res, next) => {
        await rateLimit4transactionInProgress({
            typeOf: cinerino.factory.transactionType.PlaceOrder,
            id: req.params.transactionId
        })(req, res, next);
    },
    async (req, res, next) => {
        await lockTransaction({
            typeOf: cinerino.factory.transactionType.PlaceOrder,
            id: req.params.transactionId
        })(req, res, next);
    },
    async (req, res, next) => {
        try {
            const projectRepo = new cinerino.repository.Project(mongoose.connection);
            const project = await projectRepo.findById({ id: req.project.id });
            if (project.settings === undefined) {
                throw new cinerino.factory.errors.ServiceUnavailable('Project settings undefined');
            }
            if (project.settings.mvtkReserve === undefined) {
                throw new cinerino.factory.errors.ServiceUnavailable('Project settings not found');
            }

            const action = await cinerino.service.payment.movieTicket.authorize({
                agent: { id: req.user.sub },
                object: {
                    typeOf: cinerino.factory.paymentMethodType.MovieTicket,
                    amount: 0,
                    additionalProperty: (Array.isArray(req.body.additionalProperty))
                        ? (<any[]>req.body.additionalProperty).map((p: any) => {
                            return { name: String(p.name), value: String(p.value) };
                        })
                        : [],
                    movieTickets: req.body.movieTickets
                },
                purpose: { typeOf: cinerino.factory.transactionType.PlaceOrder, id: req.params.transactionId }
            })({
                action: new cinerino.repository.Action(mongoose.connection),
                project: new cinerino.repository.Project(mongoose.connection),
                seller: new cinerino.repository.Seller(mongoose.connection),
                transaction: new cinerino.repository.Transaction(mongoose.connection),
                movieTicket: new cinerino.repository.paymentMethod.MovieTicket({
                    endpoint: project.settings.mvtkReserve.endpoint,
                    auth: mvtkReserveAuthClient
                }),
                ...(USE_EVENT_REPO) ? { event: new cinerino.repository.Event(mongoose.connection) } : undefined
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
// tslint:disable-next-line:use-default-type-parameter
placeOrderTransactionsRouter.put<ParamsDictionary>(
    '/:transactionId/actions/authorize/paymentMethod/movieTicket/:actionId/cancel',
    permitScopes(['customer', 'transactions']),
    validator,
    async (req, res, next) => {
        await rateLimit4transactionInProgress({
            typeOf: cinerino.factory.transactionType.PlaceOrder,
            id: req.params.transactionId
        })(req, res, next);
    },
    async (req, res, next) => {
        await lockTransaction({
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
// tslint:disable-next-line:use-default-type-parameter
placeOrderTransactionsRouter.post<ParamsDictionary>(
    '/:transactionId/actions/authorize/award/accounts/point',
    permitScopes(['customer', 'transactions']),
    ...[
        body('amount')
            .not()
            .isEmpty()
            .withMessage((_, __) => 'required')
            .isInt()
            .toInt(),
        body('toAccountNumber')
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
        await lockTransaction({
            typeOf: cinerino.factory.transactionType.PlaceOrder,
            id: req.params.transactionId
        })(req, res, next);
    },
    async (req, res, next) => {
        try {
            const action = await cinerino.service.transaction.placeOrderInProgress.action.authorize.award.point.create({
                transaction: { id: req.params.transactionId },
                agent: { id: req.user.sub },
                object: req.body
            })({
                action: new cinerino.repository.Action(mongoose.connection),
                ownershipInfo: new cinerino.repository.OwnershipInfo(mongoose.connection),
                project: new cinerino.repository.Project(mongoose.connection),
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
 * ポイントインセンティブ承認アクション取消
 */
// tslint:disable-next-line:use-default-type-parameter
placeOrderTransactionsRouter.put<ParamsDictionary>(
    '/:transactionId/actions/authorize/award/accounts/point/:actionId/cancel',
    permitScopes(['customer', 'transactions']),
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
        await lockTransaction({
            typeOf: cinerino.factory.transactionType.PlaceOrder,
            id: req.params.transactionId
        })(req, res, next);
    },
    async (req, res, next) => {
        try {
            await cinerino.service.transaction.placeOrderInProgress.action.authorize.award.point.cancel({
                agent: { id: req.user.sub },
                transaction: { id: req.params.transactionId },
                id: req.params.actionId
            })({
                action: new cinerino.repository.Action(mongoose.connection),
                project: new cinerino.repository.Project(mongoose.connection),
                transaction: new cinerino.repository.Transaction(mongoose.connection)
            });

            res.status(NO_CONTENT)
                .end();
        } catch (error) {
            next(error);
        }
    }
);

// tslint:disable-next-line:use-default-type-parameter
placeOrderTransactionsRouter.put<ParamsDictionary>(
    '/:transactionId/confirm',
    permitScopes(['customer', 'transactions', 'pos']),
    ...[
        // Eメールカスタマイズのバリデーション
        body([
            'emailTemplate',
            'email.about',
            'email.template',
            'email.sender.email',
            'email.toRecipient.email',
            'options.email.about',
            'options.email.template',
            'options.email.sender.email',
            'options.email.toRecipient.email'
        ])
            .optional()
            .not()
            .isEmpty()
            .withMessage((_, options) => `${options.path} must not be empty`)
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
        await lockTransaction({
            typeOf: cinerino.factory.transactionType.PlaceOrder,
            id: req.params.transactionId
        })(req, res, next);
    },
    // tslint:disable-next-line:max-func-body-length
    async (req, res, next) => {
        try {
            const orderDate = new Date();

            const actionRepo = new cinerino.repository.Action(mongoose.connection);
            const transactionRepo = new cinerino.repository.Transaction(mongoose.connection);
            const confirmationNumberRepo = new cinerino.repository.ConfirmationNumber(redis.getClient());
            const orderNumberRepo = new cinerino.repository.OrderNumber(redis.getClient());
            const sellerRepo = new cinerino.repository.Seller(mongoose.connection);
            const taskRepo = new cinerino.repository.Task(mongoose.connection);

            const sendEmailMessage = req.body.sendEmailMessage === true;
            let email: cinerino.factory.creativeWork.message.email.ICustomization | undefined = req.body.email;

            // 互換性維持のため、テンプレートオプションを変換
            if (req.body.emailTemplate !== undefined) {
                if (email === undefined) {
                    email = {};
                }
                email.template = String(req.body.emailTemplate);
            }

            let potentialActions: cinerino.factory.transaction.placeOrder.IPotentialActionsParams | undefined = req.body.potentialActions;
            if (potentialActions === undefined) {
                potentialActions = {};
            }
            if (potentialActions.order === undefined) {
                potentialActions.order = {};
            }
            if (potentialActions.order.potentialActions === undefined) {
                potentialActions.order.potentialActions = {};
            }
            if (potentialActions.order.potentialActions.sendOrder === undefined) {
                potentialActions.order.potentialActions.sendOrder = {};
            }
            if (potentialActions.order.potentialActions.sendOrder.potentialActions === undefined) {
                potentialActions.order.potentialActions.sendOrder.potentialActions = {};
            }
            if (!Array.isArray(potentialActions.order.potentialActions.sendOrder.potentialActions.sendEmailMessage)) {
                potentialActions.order.potentialActions.sendOrder.potentialActions.sendEmailMessage = [];
            }
            if (sendEmailMessage) {
                potentialActions.order.potentialActions.sendOrder.potentialActions.sendEmailMessage.push({
                    object: email
                });
            }

            const confirmationNumber:
                string | cinerino.service.transaction.placeOrderInProgress.IConfirmationNumberGenerator | undefined = undefined;

            const resultOrderParams: cinerino.service.transaction.placeOrderInProgress.IResultOrderParams = {
                ...(req.body.result !== undefined && req.body.result !== null) ? req.body.result.order : undefined,
                confirmationNumber: confirmationNumber,
                orderDate: orderDate,
                numItems: {
                    maxValue: NUM_ORDER_ITEMS_MAX_VALUE
                    // minValue: 0
                }
            };

            const result = await cinerino.service.transaction.placeOrderInProgress.confirm({
                ...req.body,
                agent: { id: req.user.sub },
                id: req.params.transactionId,
                potentialActions: potentialActions,
                project: req.project,
                result: {
                    ...req.body.result,
                    order: resultOrderParams
                },
                validateMovieTicket: (process.env.VALIDATE_MOVIE_TICKET === '1')
            })({
                action: actionRepo,
                transaction: transactionRepo,
                confirmationNumber: confirmationNumberRepo,
                orderNumber: orderNumberRepo,
                seller: sellerRepo
            });

            // 非同期でタスクエクスポート(APIレスポンスタイムに影響を与えないように)
            // tslint:disable-next-line:no-floating-promises
            cinerino.service.transaction.placeOrder.exportTasks({
                project: (MULTI_TENANT_SUPPORTED) ? req.project : undefined,
                status: cinerino.factory.transactionStatusType.Confirmed
            })({
                task: taskRepo,
                transaction: transactionRepo
            })
                .then(async (tasks) => {
                    // タスクがあればすべて実行
                    if (Array.isArray(tasks)) {
                        await Promise.all(tasks.map(async (task) => {
                            await cinerino.service.task.executeByName(task)({
                                connection: mongoose.connection,
                                redisClient: redis.getClient()
                            });
                        }));
                    }
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
    permitScopes(['customer', 'transactions']),
    validator,
    async (req, res, next) => {
        await rateLimit4transactionInProgress({
            typeOf: cinerino.factory.transactionType.PlaceOrder,
            id: req.params.transactionId
        })(req, res, next);
    },
    async (req, res, next) => {
        await lockTransaction({
            typeOf: cinerino.factory.transactionType.PlaceOrder,
            id: req.params.transactionId
        })(req, res, next);
    },
    async (req, res, next) => {
        try {
            const taskRepo = new cinerino.repository.Task(mongoose.connection);
            const transactionRepo = new cinerino.repository.Transaction(mongoose.connection);
            await transactionRepo.cancel({
                typeOf: cinerino.factory.transactionType.PlaceOrder,
                id: req.params.transactionId
            });

            // 非同期でタスクエクスポート(APIレスポンスタイムに影響を与えないように)
            // tslint:disable-next-line:no-floating-promises
            cinerino.service.transaction.placeOrder.exportTasks({
                project: (MULTI_TENANT_SUPPORTED) ? req.project : undefined,
                status: cinerino.factory.transactionStatusType.Canceled
            })({
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
    permitScopes([]),
    rateLimit,
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
                project: (MULTI_TENANT_SUPPORTED) ? { ids: [req.project.id] } : undefined,
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
    permitScopes([]),
    rateLimit,
    validator,
    async (req, res, next) => {
        try {
            const actionRepo = new cinerino.repository.Action(mongoose.connection);
            const actions = await actionRepo.searchByPurpose({
                purpose: {
                    typeOf: cinerino.factory.transactionType.PlaceOrder,
                    id: req.params.transactionId
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
    permitScopes([]),
    rateLimit,
    validator,
    async (req, res, next) => {
        try {
            const transactionRepo = new cinerino.repository.Transaction(mongoose.connection);
            const searchConditions: cinerino.factory.transaction.ISearchConditions<cinerino.factory.transactionType.PlaceOrder> = {
                limit: undefined,
                page: undefined,
                project: (MULTI_TENANT_SUPPORTED) ? { ids: [req.project.id] } : undefined,
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
