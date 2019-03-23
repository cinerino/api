/**
 * 注文取引ルーター
 * Cinemasunshinに互換性を維持するためのルーター
 * 可能な部分から順次placeOrderTransactionsRouterへ移行していくことが望ましい
 */
import * as cinerino from '@cinerino/domain';

import * as createDebug from 'debug';
import { Router } from 'express';
// tslint:disable-next-line:no-submodule-imports
// import { query } from 'express-validator/check';
import { CREATED, NO_CONTENT } from 'http-status';
import * as mongoose from 'mongoose';

import permitScopes from '../../middlewares/permitScopes';
import rateLimit4transactionInProgress from '../../middlewares/rateLimit4transactionInProgress';
import validator from '../../middlewares/validator';

import * as redis from '../../../redis';

const debug = createDebug('cinerino-api:router');

const pecorinoAuthClient = new cinerino.pecorinoapi.auth.ClientCredentials({
    domain: <string>process.env.PECORINO_AUTHORIZE_SERVER_DOMAIN,
    clientId: <string>process.env.PECORINO_CLIENT_ID,
    clientSecret: <string>process.env.PECORINO_CLIENT_SECRET,
    scopes: [],
    state: ''
});

export interface ICOATicket extends cinerino.COA.services.master.ITicketResult {
    theaterCode: string;
}

let coaTickets: ICOATicket[];

function initializeCOATickets() {
    return async (repos: { seller: cinerino.repository.Seller }) => {
        try {
            const tickets: ICOATicket[] = [];

            const branchCodes: string[] = [];
            const sellers = await repos.seller.search({});
            sellers.forEach(async (seller) => {
                if (Array.isArray(seller.makesOffer)) {
                    branchCodes.push(...seller.makesOffer.map((o) => o.itemOffered.reservationFor.location.branchCode));
                }
            });

            await Promise.all(branchCodes.map(async (branchCode) => {
                const ticketResults = await cinerino.COA.services.master.ticket({ theaterCode: branchCode });
                debug(branchCode, ticketResults.length, 'COA Tickets found');
                tickets.push(...ticketResults.map((t) => {
                    return { ...t, theaterCode: branchCode };
                }));
            }));

            coaTickets = tickets;
        } catch (error) {
            // no op
        }
    };
}

const USE_IN_MEMORY_OFFER_REPO = (process.env.USE_IN_MEMORY_OFFER_REPO === '1') ? true : false;
if (USE_IN_MEMORY_OFFER_REPO) {
    initializeCOATickets()({ seller: new cinerino.repository.Seller(mongoose.connection) })
        .then()
        // tslint:disable-next-line:no-console
        .catch(console.error);

    const HOUR = 3600000;
    setInterval(
        async () => {
            try {
                await initializeCOATickets()({ seller: new cinerino.repository.Seller(mongoose.connection) });
            } catch (error) {
                // tslint:disable-next-line:no-console
                console.error(error);
            }
        },
        // tslint:disable-next-line:no-magic-numbers
        HOUR
    );
}

/**
 * ポイントインセンティブ名
 */
const POINT_AWARD = 'PecorinoPayment';

const placeOrder4cinemasunshineRouter = Router();

/**
 * 座席仮予約
 */
placeOrder4cinemasunshineRouter.post(
    '/:transactionId/actions/authorize/seatReservation',
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
            const action = await cinerino.service.transaction.placeOrderInProgress.action.authorize.offer.seatReservation4coa.create({
                object: {
                    event: { id: <string>req.body.eventIdentifier },
                    acceptedOffer: req.body.offers
                },
                agent: { id: req.user.sub },
                transaction: { id: <string>req.params.transactionId }
            })({
                action: new cinerino.repository.Action(mongoose.connection),
                event: new cinerino.repository.Event(mongoose.connection),
                transaction: new cinerino.repository.Transaction(mongoose.connection),
                offer: (coaTickets !== undefined) ? new cinerino.repository.Offer(coaTickets) : undefined
            });

            res.status(CREATED)
                .json(action);
        } catch (error) {
            next(error);
        }
    }
);

/**
 * 座席仮予約削除
 */
placeOrder4cinemasunshineRouter.delete(
    '/:transactionId/actions/authorize/seatReservation/:actionId',
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
            await cinerino.service.transaction.placeOrderInProgress.action.authorize.offer.seatReservation4coa.cancel({
                agent: { id: req.user.sub },
                transaction: { id: <string>req.params.transactionId },
                id: <string>req.params.actionId
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
 * 座席仮予へ変更(券種変更)
 */
placeOrder4cinemasunshineRouter.patch(
    '/:transactionId/actions/authorize/seatReservation/:actionId',
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
            const action = await cinerino.service.transaction.placeOrderInProgress.action.authorize.offer.seatReservation4coa.changeOffers({
                object: {
                    event: { id: <string>req.body.eventIdentifier },
                    acceptedOffer: req.body.offers
                },
                agent: { id: req.user.sub },
                transaction: { id: <string>req.params.transactionId },
                id: <string>req.params.actionId
            })({
                action: new cinerino.repository.Action(mongoose.connection),
                event: new cinerino.repository.Event(mongoose.connection),
                offer: (coaTickets !== undefined) ? new cinerino.repository.Offer(coaTickets) : undefined,
                transaction: new cinerino.repository.Transaction(mongoose.connection)
            });

            res.json(action);
        } catch (error) {
            next(error);
        }
    }
);

/**
 * 会員プログラムオファー承認アクション
 */
placeOrder4cinemasunshineRouter.post(
    '/:transactionId/actions/authorize/offer/programMembership',
    permitScopes(['aws.cognito.signin.user.admin', 'transactions']),
    validator,
    async (req, res, next) => {
        await rateLimit4transactionInProgress({
            typeOf: cinerino.factory.transactionType.PlaceOrder,
            id: req.params.transactionId
        })(req, res, next);
    },
    async (_, res, next) => {
        try {
            // tslint:disable-next-line:no-suspicious-comment
            // TODO 実装

            res.status(CREATED)
                .json({});
        } catch (error) {
            next(error);
        }
    }
);

/**
 * 会員プログラムオファー承認アクション取消
 */
placeOrder4cinemasunshineRouter.delete(
    '/:transactionId/actions/authorize/offer/programMembership/:actionId',
    permitScopes(['aws.cognito.signin.user.admin', 'transactions']),
    validator,
    async (req, res, next) => {
        await rateLimit4transactionInProgress({
            typeOf: cinerino.factory.transactionType.PlaceOrder,
            id: req.params.transactionId
        })(req, res, next);
    },
    async (_, res, next) => {
        try {
            // tslint:disable-next-line:no-suspicious-comment
            // TODO 実装

            res.status(NO_CONTENT)
                .end();
        } catch (error) {
            next(error);
        }
    }
);

/**
 * クレジットカードオーソリ
 */
placeOrder4cinemasunshineRouter.post(
    '/:transactionId/actions/authorize/creditCard',
    permitScopes(['aws.cognito.signin.user.admin', 'transactions']),
    (req, __2, next) => {
        req.checkBody('orderId', 'invalid orderId')
            .notEmpty()
            .withMessage('orderId is required');
        req.checkBody('amount', 'invalid amount')
            .notEmpty()
            .withMessage('amount is required');
        req.checkBody('method', 'invalid method')
            .notEmpty()
            .withMessage('method is required');
        req.checkBody('creditCard', 'invalid creditCard')
            .notEmpty()
            .withMessage('creditCard is required');

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
            // 会員IDを強制的にログイン中の人物IDに変更
            type ICreditCard4authorizeAction = cinerino.factory.action.authorize.paymentMethod.creditCard.ICreditCard;
            const creditCard: ICreditCard4authorizeAction = {
                ...req.body.creditCard,
                ...{
                    memberId: (req.user.username !== undefined) ? req.user.username : undefined
                }
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
                    orderId: <string>req.body.orderId,
                    amount: Number(<string>req.body.amount),
                    method: req.body.method,
                    creditCard: creditCard
                },
                purpose: { typeOf: cinerino.factory.transactionType.PlaceOrder, id: <string>req.params.transactionId }
            })({
                action: new cinerino.repository.Action(mongoose.connection),
                transaction: new cinerino.repository.Transaction(mongoose.connection),
                seller: new cinerino.repository.Seller(mongoose.connection)
            });

            res.status(CREATED)
                .json({
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
placeOrder4cinemasunshineRouter.delete(
    '/:transactionId/actions/authorize/creditCard/:actionId',
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
                agent: { id: req.user.sub },
                id: <string>req.params.actionId,
                purpose: { typeOf: cinerino.factory.transactionType.PlaceOrder, id: <string>req.params.transactionId }
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
 * ムビチケ追加
 */
placeOrder4cinemasunshineRouter.post(
    '/:transactionId/actions/authorize/mvtk',
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
            const authorizeObject = {
                typeOf: cinerino.factory.action.authorize.discount.mvtk.ObjectType.Mvtk,
                price: Number(req.body.price),
                transactionId: <string>req.params.transactionId,
                seatInfoSyncIn: {
                    kgygishCd: req.body.seatInfoSyncIn.kgygishCd,
                    yykDvcTyp: req.body.seatInfoSyncIn.yykDvcTyp,
                    trkshFlg: req.body.seatInfoSyncIn.trkshFlg,
                    kgygishSstmZskyykNo: req.body.seatInfoSyncIn.kgygishSstmZskyykNo,
                    kgygishUsrZskyykNo: req.body.seatInfoSyncIn.kgygishUsrZskyykNo,
                    jeiDt: req.body.seatInfoSyncIn.jeiDt,
                    kijYmd: req.body.seatInfoSyncIn.kijYmd,
                    stCd: req.body.seatInfoSyncIn.stCd,
                    screnCd: req.body.seatInfoSyncIn.screnCd,
                    knyknrNoInfo: req.body.seatInfoSyncIn.knyknrNoInfo,
                    zskInfo: req.body.seatInfoSyncIn.zskInfo,
                    skhnCd: req.body.seatInfoSyncIn.skhnCd
                }
            };

            const mvtkService = cinerino.service.transaction.placeOrderInProgress.action.authorize.discount.mvtk;
            const actions = await mvtkService.createMovieTicketPaymentAuthorization({
                agentId: req.user.sub,
                transactionId: <string>req.params.transactionId,
                authorizeObject: authorizeObject
            })({
                action: new cinerino.repository.Action(mongoose.connection),
                paymentMethod: new cinerino.repository.PaymentMethod(mongoose.connection),
                transaction: new cinerino.repository.Transaction(mongoose.connection)
            });

            res.status(CREATED)
                .json({
                    // ムビチケ承認アクションが購入管理番号数分作成されるので、本来リストを返す必要があるが
                    // シネマサンシャインでは、承認取消時にバックエンドでは何も処理していないので、いったんこれで回避
                    id: actions[0].id
                });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * ムビチケ取消
 */
placeOrder4cinemasunshineRouter.delete(
    '/:transactionId/actions/authorize/mvtk/:actionId',
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
            await cinerino.service.transaction.placeOrderInProgress.action.authorize.discount.mvtk.cancel({
                agentId: req.user.sub,
                transactionId: <string>req.params.transactionId,
                actionId: <string>req.params.actionId
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
 * ポイント口座確保
 */
placeOrder4cinemasunshineRouter.post(
    '/:transactionId/actions/authorize/paymentMethod/pecorino',
    permitScopes(['aws.cognito.signin.user.admin', 'transactions']),
    (req, __, next) => {
        req.checkBody('amount', 'invalid amount')
            .notEmpty()
            .withMessage('amount is required')
            .isInt();
        req.checkBody('fromAccountNumber', 'invalid fromAccountNumber')
            .notEmpty()
            .withMessage('fromAccountNumber is required');
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
            const now = new Date();
            const ownershipInfoRepo = new cinerino.repository.OwnershipInfo(mongoose.connection);

            // 必要な会員プログラムに加入しているかどうか確認
            const programMemberships = await ownershipInfoRepo.search<cinerino.factory.programMembership.ProgramMembershipType>({
                typeOfGood: {
                    typeOf: 'ProgramMembership'
                },
                ownedBy: { id: req.user.sub },
                ownedFrom: now,
                ownedThrough: now
            });
            const pecorinoPaymentAward = programMemberships.reduce((a, b) => [...a, ...b.typeOfGood.award], [])
                .find((a) => a === POINT_AWARD);
            if (pecorinoPaymentAward === undefined) {
                throw new cinerino.factory.errors.Forbidden('Membership program requirements not satisfied');
            }

            // pecorino転送取引サービスクライアントを生成
            const transferService = new cinerino.pecorinoapi.service.transaction.Transfer({
                endpoint: <string>process.env.PECORINO_ENDPOINT,
                auth: pecorinoAuthClient
            });

            const actionRepo = new cinerino.repository.Action(mongoose.connection);
            const sellerRepo = new cinerino.repository.Seller(mongoose.connection);
            const transactionRepo = new cinerino.repository.Transaction(mongoose.connection);

            // 注文取引の場合、販売者の口座を検索して、toAccountにセット
            let toAccount: cinerino.factory.action.authorize.paymentMethod.account.IToAccount<cinerino.factory.accountType>;

            const transaction = await transactionRepo.findById({
                typeOf: cinerino.factory.transactionType.PlaceOrder,
                id: req.params.transactionId
            });
            const seller = await sellerRepo.findById({
                id: transaction.seller.id
            });

            if (seller.paymentAccepted === undefined) {
                throw new cinerino.factory.errors.Argument('object', 'Account payment not accepted.');
            }
            const accountPaymentsAccepted = <cinerino.factory.seller.IPaymentAccepted<cinerino.factory.paymentMethodType.Account>[]>
                seller.paymentAccepted.filter((a) => a.paymentMethodType === cinerino.factory.paymentMethodType.Account);
            const paymentAccepted = accountPaymentsAccepted.find((a) => a.accountType === cinerino.factory.accountType.Point);
            // tslint:disable-next-line:no-single-line-block-comment
            /* istanbul ignore if */
            if (paymentAccepted === undefined) {
                throw new cinerino.factory.errors.Argument('object', `${cinerino.factory.accountType.Point} payment not accepted`);
            }
            toAccount = {
                accountNumber: paymentAccepted.accountNumber,
                accountType: paymentAccepted.accountType
            };

            const action = await cinerino.service.payment.account.authorize({
                agent: { id: req.user.sub },
                object: {
                    typeOf: cinerino.factory.paymentMethodType.Account,
                    amount: Number(req.body.amount),
                    currency: cinerino.factory.accountType.Point,
                    fromAccount: {
                        accountType: cinerino.factory.accountType.Point,
                        accountNumber: <string>req.body.fromAccountNumber
                    },
                    toAccount: toAccount,
                    notes: <string>req.body.notes
                },
                purpose: { typeOf: cinerino.factory.transactionType.PlaceOrder, id: <string>req.params.transactionId }
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
 * ポイント口座承認取消
 */
placeOrder4cinemasunshineRouter.delete(
    '/:transactionId/actions/authorize/paymentMethod/pecorino/:actionId',
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
            // pecorino転送取引サービスクライアントを生成
            const transferService = new cinerino.pecorinoapi.service.transaction.Transfer({
                endpoint: <string>process.env.PECORINO_ENDPOINT,
                auth: pecorinoAuthClient
            });
            await cinerino.service.payment.account.voidTransaction({
                agent: { id: req.user.sub },
                id: <string>req.params.actionId,
                purpose: { typeOf: cinerino.factory.transactionType.PlaceOrder, id: <string>req.params.transactionId }
            })({
                action: new cinerino.repository.Action(mongoose.connection),
                transaction: new cinerino.repository.Transaction(mongoose.connection),
                transferTransactionService: transferService
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
placeOrder4cinemasunshineRouter.post(
    '/:transactionId/actions/authorize/award/pecorino',
    permitScopes(['aws.cognito.signin.user.admin', 'transactions']),
    (req, __2, next) => {
        req.checkBody('amount', 'invalid amount')
            .notEmpty()
            .withMessage('amount is required')
            .isInt();
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
            const now = new Date();
            const ownershipInfoRepo = new cinerino.repository.OwnershipInfo(mongoose.connection);

            const programMemberships = await ownershipInfoRepo.search<cinerino.factory.programMembership.ProgramMembershipType>({
                typeOfGood: {
                    typeOf: 'ProgramMembership'
                },
                ownedBy: { id: req.user.sub },
                ownedFrom: now,
                ownedThrough: now
            });
            const pecorinoPaymentAward = programMemberships.reduce((a, b) => [...a, ...b.typeOfGood.award], [])
                .find((a) => a === POINT_AWARD);
            if (pecorinoPaymentAward === undefined) {
                throw new cinerino.factory.errors.Forbidden('Membership program requirements not satisfied');
            }

            // pecorino転送取引サービスクライアントを生成
            const depositService = new cinerino.pecorinoapi.service.transaction.Deposit({
                endpoint: <string>process.env.PECORINO_ENDPOINT,
                auth: pecorinoAuthClient
            });
            const action = await cinerino.service.transaction.placeOrderInProgress.action.authorize.award.point.create({
                agent: { id: req.user.sub },
                transaction: { id: <string>req.params.transactionId },
                object: {
                    amount: Number(req.body.amount),
                    toAccountNumber: <string>req.body.toAccountNumber,
                    notes: <string>req.body.notes
                }
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
placeOrder4cinemasunshineRouter.delete(
    '/:transactionId/actions/authorize/award/pecorino/:actionId',
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
            const depositService = new cinerino.pecorinoapi.service.transaction.Deposit({
                endpoint: <string>process.env.PECORINO_ENDPOINT,
                auth: pecorinoAuthClient
            });
            await cinerino.service.transaction.placeOrderInProgress.action.authorize.award.point.cancel({
                agent: { id: req.user.sub },
                transaction: { id: <string>req.params.transactionId },
                id: <string>req.params.actionId
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

placeOrder4cinemasunshineRouter.post(
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
            const { order } = await cinerino.service.transaction.placeOrderInProgress.confirm({
                id: <string>req.params.transactionId,
                agent: { id: req.user.sub },
                result: {
                    order: {
                        orderDate: orderDate,
                        confirmationNumber: (params) => {
                            const firstOffer = params.acceptedOffers[0];

                            // COAに適合させるため、座席予約の場合、確認番号をCOA予約番号に強制変換
                            if (firstOffer !== undefined
                                && firstOffer.itemOffered.typeOf === cinerino.factory.chevre.reservationType.EventReservation) {
                                return Number(firstOffer.itemOffered.reservationNumber);
                            } else {
                                return params.confirmationNumber;
                            }
                        }
                    }
                },
                options: {
                    ...req.body,
                    sendEmailMessage: (req.body.sendEmailMessage === true) ? true : false
                }
            })({
                action: new cinerino.repository.Action(mongoose.connection),
                transaction: new cinerino.repository.Transaction(mongoose.connection),
                orderNumber: new cinerino.repository.OrderNumber(redis.getClient()),
                seller: new cinerino.repository.Seller(mongoose.connection)
            });
            debug('transaction confirmed', order);

            // 非同期でタスクエクスポート(APIレスポンスタイムに影響を与えないように)
            // tslint:disable-next-line:no-floating-promises
            cinerino.service.transaction.placeOrder.exportTasks(cinerino.factory.transactionStatusType.Confirmed)({
                task: new cinerino.repository.Task(mongoose.connection),
                transaction: new cinerino.repository.Transaction(mongoose.connection)
            });

            res.status(CREATED)
                .json(order);
        } catch (error) {
            next(error);
        }
    }
);

/**
 * 取引を明示的に中止
 */
placeOrder4cinemasunshineRouter.post(
    '/:transactionId/cancel',
    permitScopes(['admin', 'aws.cognito.signin.user.admin', 'transactions']),
    validator,
    async (req, res, next) => {
        try {
            const transactionRepo = new cinerino.repository.Transaction(mongoose.connection);
            await transactionRepo.cancel({
                typeOf: cinerino.factory.transactionType.PlaceOrder,
                id: <string>req.params.transactionId
            });
            debug('transaction canceled.');
            res.status(NO_CONTENT)
                .end();
        } catch (error) {
            next(error);
        }
    }
);

placeOrder4cinemasunshineRouter.post(
    '/:transactionId/tasks/sendEmailNotification',
    permitScopes(['aws.cognito.signin.user.admin', 'transactions']),
    validator,
    async (req, res, next) => {
        try {
            const task = await cinerino.service.transaction.placeOrder.sendEmail(
                <string>req.params.transactionId,
                {
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
                }
            )({
                task: new cinerino.repository.Task(mongoose.connection),
                transaction: new cinerino.repository.Transaction(mongoose.connection)
            });

            res.status(CREATED)
                .json(task);
        } catch (error) {
            next(error);
        }
    }
);

export default placeOrder4cinemasunshineRouter;
