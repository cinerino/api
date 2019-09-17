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

import lockTransaction from '../../middlewares/lockTransaction';
import permitScopes from '../../middlewares/permitScopes';
import rateLimit4transactionInProgress from '../../middlewares/rateLimit4transactionInProgress';
import validator from '../../middlewares/validator';

import * as redis from '../../../redis';

const debug = createDebug('cinerino-api:router');

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
            const action = await cinerino.service.transaction.placeOrderInProgress.action.authorize.offer.seatReservation4coa.create({
                object: {
                    event: { id: <string>req.body.eventIdentifier },
                    acceptedOffer: req.body.offers
                },
                agent: { id: req.user.sub },
                transaction: { id: req.params.transactionId }
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
            await cinerino.service.transaction.placeOrderInProgress.action.authorize.offer.seatReservation4coa.cancel({
                agent: { id: req.user.sub },
                transaction: { id: req.params.transactionId },
                id: req.params.actionId
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
            const action = await cinerino.service.transaction.placeOrderInProgress.action.authorize.offer.seatReservation4coa.changeOffers({
                object: {
                    event: { id: req.body.eventIdentifier },
                    acceptedOffer: req.body.offers
                },
                agent: { id: req.user.sub },
                transaction: { id: req.params.transactionId },
                id: req.params.actionId
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
 * ムビチケ追加
 */
placeOrder4cinemasunshineRouter.post(
    '/:transactionId/actions/authorize/mvtk',
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
            const authorizeObject = {
                typeOf: cinerino.factory.action.authorize.discount.mvtk.ObjectType.Mvtk,
                price: Number(req.body.price),
                transactionId: req.params.transactionId,
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
                project: req.project,
                agentId: req.user.sub,
                transactionId: req.params.transactionId,
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
            await cinerino.service.transaction.placeOrderInProgress.action.authorize.discount.mvtk.cancel({
                agentId: req.user.sub,
                transactionId: req.params.transactionId,
                actionId: req.params.actionId
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
placeOrder4cinemasunshineRouter.post(
    '/:transactionId/actions/authorize/award/pecorino',
    permitScopes(['customer', 'transactions']),
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
        await lockTransaction({
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
                    typeOf: cinerino.factory.programMembership.ProgramMembershipType.ProgramMembership
                },
                ownedBy: { id: req.user.sub },
                ownedFrom: now,
                ownedThrough: now
            });
            const pecorinoPaymentAward = programMemberships.reduce(
                (a, b) => {
                    return [...a, ...(Array.isArray(b.typeOfGood.award) ? b.typeOfGood.award : [])];
                },
                []
            )
                .find((a) => a === POINT_AWARD);
            if (pecorinoPaymentAward === undefined) {
                throw new cinerino.factory.errors.Forbidden('Membership program requirements not satisfied');
            }

            const action = await cinerino.service.transaction.placeOrderInProgress.action.authorize.award.point.create({
                agent: { id: req.user.sub },
                transaction: { id: req.params.transactionId },
                object: {
                    amount: Number(req.body.amount),
                    toAccountNumber: <string>req.body.toAccountNumber,
                    notes: <string>req.body.notes
                }
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
placeOrder4cinemasunshineRouter.delete(
    '/:transactionId/actions/authorize/award/pecorino/:actionId',
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

placeOrder4cinemasunshineRouter.post(
    '/:transactionId/confirm',
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
            const orderDate = new Date();

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

            const { order } = await cinerino.service.transaction.placeOrderInProgress.confirm({
                ...req.body,
                agent: { id: req.user.sub },
                id: req.params.transactionId,
                potentialActions: potentialActions,
                project: req.project,
                result: {
                    order: {
                        orderDate: orderDate,
                        confirmationNumber: (params) => {
                            const firstOffer = params.acceptedOffers[0];

                            // COAに適合させるため、座席予約の場合、確認番号をCOA予約番号に強制変換
                            if (firstOffer !== undefined
                                && firstOffer.itemOffered.typeOf === cinerino.factory.chevre.reservationType.EventReservation) {
                                return String(firstOffer.itemOffered.reservationNumber);
                            } else {
                                return params.confirmationNumber;
                            }
                        }
                    }
                }
            })({
                action: new cinerino.repository.Action(mongoose.connection),
                transaction: new cinerino.repository.Transaction(mongoose.connection),
                orderNumber: new cinerino.repository.OrderNumber(redis.getClient()),
                seller: new cinerino.repository.Seller(mongoose.connection)
            });

            // 非同期でタスクエクスポート(APIレスポンスタイムに影響を与えないように)
            // tslint:disable-next-line:no-floating-promises
            cinerino.service.transaction.placeOrder.exportTasks({
                project: undefined,
                status: cinerino.factory.transactionStatusType.Confirmed
            })({
                task: new cinerino.repository.Task(mongoose.connection),
                transaction: new cinerino.repository.Transaction(mongoose.connection)
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

            res.status(CREATED)
                .json(order);
        } catch (error) {
            next(error);
        }
    }
);

export default placeOrder4cinemasunshineRouter;
