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
 * Cinemasunshinに互換性を維持するためのルーター
 * 可能な部分から順次placeOrderTransactionsRouterへ移行していくことが望ましい
 */
const cinerino = require("@cinerino/domain");
const createDebug = require("debug");
const express_1 = require("express");
// tslint:disable-next-line:no-submodule-imports
// import { query } from 'express-validator/check';
const http_status_1 = require("http-status");
const mongoose = require("mongoose");
const lockTransaction_1 = require("../../middlewares/lockTransaction");
const permitScopes_1 = require("../../middlewares/permitScopes");
const rateLimit4transactionInProgress_1 = require("../../middlewares/rateLimit4transactionInProgress");
const validator_1 = require("../../middlewares/validator");
const redis = require("../../../redis");
const debug = createDebug('cinerino-api:router');
let coaTickets;
function initializeCOATickets() {
    return (repos) => __awaiter(this, void 0, void 0, function* () {
        try {
            const tickets = [];
            const branchCodes = [];
            const sellers = yield repos.seller.search({});
            sellers.forEach((seller) => __awaiter(this, void 0, void 0, function* () {
                if (Array.isArray(seller.makesOffer)) {
                    branchCodes.push(...seller.makesOffer.map((o) => o.itemOffered.reservationFor.location.branchCode));
                }
            }));
            yield Promise.all(branchCodes.map((branchCode) => __awaiter(this, void 0, void 0, function* () {
                const ticketResults = yield cinerino.COA.services.master.ticket({ theaterCode: branchCode });
                debug(branchCode, ticketResults.length, 'COA Tickets found');
                tickets.push(...ticketResults.map((t) => {
                    return Object.assign({}, t, { theaterCode: branchCode });
                }));
            })));
            coaTickets = tickets;
        }
        catch (error) {
            // no op
        }
    });
}
const USE_IN_MEMORY_OFFER_REPO = (process.env.USE_IN_MEMORY_OFFER_REPO === '1') ? true : false;
if (USE_IN_MEMORY_OFFER_REPO) {
    initializeCOATickets()({ seller: new cinerino.repository.Seller(mongoose.connection) })
        .then()
        // tslint:disable-next-line:no-console
        .catch(console.error);
    const HOUR = 3600000;
    setInterval(() => __awaiter(this, void 0, void 0, function* () {
        try {
            yield initializeCOATickets()({ seller: new cinerino.repository.Seller(mongoose.connection) });
        }
        catch (error) {
            // tslint:disable-next-line:no-console
            console.error(error);
        }
    }), 
    // tslint:disable-next-line:no-magic-numbers
    HOUR);
}
/**
 * ポイントインセンティブ名
 */
const POINT_AWARD = 'PecorinoPayment';
const placeOrder4cinemasunshineRouter = express_1.Router();
/**
 * 座席仮予約
 */
placeOrder4cinemasunshineRouter.post('/:transactionId/actions/authorize/seatReservation', permitScopes_1.default(['customer', 'transactions']), validator_1.default, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    yield rateLimit4transactionInProgress_1.default({
        typeOf: cinerino.factory.transactionType.PlaceOrder,
        id: req.params.transactionId
    })(req, res, next);
}), (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    yield lockTransaction_1.default({
        typeOf: cinerino.factory.transactionType.PlaceOrder,
        id: req.params.transactionId
    })(req, res, next);
}), (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const action = yield cinerino.service.transaction.placeOrderInProgress.action.authorize.offer.seatReservation4coa.create({
            object: {
                event: { id: req.body.eventIdentifier },
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
        res.status(http_status_1.CREATED)
            .json(action);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * 座席仮予約削除
 */
placeOrder4cinemasunshineRouter.delete('/:transactionId/actions/authorize/seatReservation/:actionId', permitScopes_1.default(['customer', 'transactions']), validator_1.default, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    yield rateLimit4transactionInProgress_1.default({
        typeOf: cinerino.factory.transactionType.PlaceOrder,
        id: req.params.transactionId
    })(req, res, next);
}), (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    yield lockTransaction_1.default({
        typeOf: cinerino.factory.transactionType.PlaceOrder,
        id: req.params.transactionId
    })(req, res, next);
}), (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        yield cinerino.service.transaction.placeOrderInProgress.action.authorize.offer.seatReservation4coa.cancel({
            agent: { id: req.user.sub },
            transaction: { id: req.params.transactionId },
            id: req.params.actionId
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
 * 座席仮予へ変更(券種変更)
 */
placeOrder4cinemasunshineRouter.patch('/:transactionId/actions/authorize/seatReservation/:actionId', permitScopes_1.default(['customer', 'transactions']), validator_1.default, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    yield rateLimit4transactionInProgress_1.default({
        typeOf: cinerino.factory.transactionType.PlaceOrder,
        id: req.params.transactionId
    })(req, res, next);
}), (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    yield lockTransaction_1.default({
        typeOf: cinerino.factory.transactionType.PlaceOrder,
        id: req.params.transactionId
    })(req, res, next);
}), (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const action = yield cinerino.service.transaction.placeOrderInProgress.action.authorize.offer.seatReservation4coa.changeOffers({
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
    }
    catch (error) {
        next(error);
    }
}));
/**
 * 会員プログラムオファー承認アクション
 */
placeOrder4cinemasunshineRouter.post('/:transactionId/actions/authorize/offer/programMembership', permitScopes_1.default(['customer', 'transactions']), validator_1.default, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    yield rateLimit4transactionInProgress_1.default({
        typeOf: cinerino.factory.transactionType.PlaceOrder,
        id: req.params.transactionId
    })(req, res, next);
}), (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    yield lockTransaction_1.default({
        typeOf: cinerino.factory.transactionType.PlaceOrder,
        id: req.params.transactionId
    })(req, res, next);
}), (_, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        // tslint:disable-next-line:no-suspicious-comment
        // TODO 実装
        res.status(http_status_1.CREATED)
            .json({});
    }
    catch (error) {
        next(error);
    }
}));
/**
 * 会員プログラムオファー承認アクション取消
 */
placeOrder4cinemasunshineRouter.delete('/:transactionId/actions/authorize/offer/programMembership/:actionId', permitScopes_1.default(['customer', 'transactions']), validator_1.default, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    yield rateLimit4transactionInProgress_1.default({
        typeOf: cinerino.factory.transactionType.PlaceOrder,
        id: req.params.transactionId
    })(req, res, next);
}), (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    yield lockTransaction_1.default({
        typeOf: cinerino.factory.transactionType.PlaceOrder,
        id: req.params.transactionId
    })(req, res, next);
}), (_, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        // tslint:disable-next-line:no-suspicious-comment
        // TODO 実装
        res.status(http_status_1.NO_CONTENT)
            .end();
    }
    catch (error) {
        next(error);
    }
}));
/**
 * ムビチケ追加
 */
placeOrder4cinemasunshineRouter.post('/:transactionId/actions/authorize/mvtk', permitScopes_1.default(['customer', 'transactions']), validator_1.default, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    yield rateLimit4transactionInProgress_1.default({
        typeOf: cinerino.factory.transactionType.PlaceOrder,
        id: req.params.transactionId
    })(req, res, next);
}), (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    yield lockTransaction_1.default({
        typeOf: cinerino.factory.transactionType.PlaceOrder,
        id: req.params.transactionId
    })(req, res, next);
}), (req, res, next) => __awaiter(this, void 0, void 0, function* () {
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
        const actions = yield mvtkService.createMovieTicketPaymentAuthorization({
            project: req.project,
            agentId: req.user.sub,
            transactionId: req.params.transactionId,
            authorizeObject: authorizeObject
        })({
            action: new cinerino.repository.Action(mongoose.connection),
            paymentMethod: new cinerino.repository.PaymentMethod(mongoose.connection),
            transaction: new cinerino.repository.Transaction(mongoose.connection)
        });
        res.status(http_status_1.CREATED)
            .json({
            // ムビチケ承認アクションが購入管理番号数分作成されるので、本来リストを返す必要があるが
            // シネマサンシャインでは、承認取消時にバックエンドでは何も処理していないので、いったんこれで回避
            id: actions[0].id
        });
    }
    catch (error) {
        next(error);
    }
}));
/**
 * ムビチケ取消
 */
placeOrder4cinemasunshineRouter.delete('/:transactionId/actions/authorize/mvtk/:actionId', permitScopes_1.default(['customer', 'transactions']), validator_1.default, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    yield rateLimit4transactionInProgress_1.default({
        typeOf: cinerino.factory.transactionType.PlaceOrder,
        id: req.params.transactionId
    })(req, res, next);
}), (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    yield lockTransaction_1.default({
        typeOf: cinerino.factory.transactionType.PlaceOrder,
        id: req.params.transactionId
    })(req, res, next);
}), (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        yield cinerino.service.transaction.placeOrderInProgress.action.authorize.discount.mvtk.cancel({
            agentId: req.user.sub,
            transactionId: req.params.transactionId,
            actionId: req.params.actionId
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
placeOrder4cinemasunshineRouter.post('/:transactionId/actions/authorize/award/pecorino', permitScopes_1.default(['customer', 'transactions']), (req, __2, next) => {
    req.checkBody('amount', 'invalid amount')
        .notEmpty()
        .withMessage('amount is required')
        .isInt();
    req.checkBody('toAccountNumber', 'invalid toAccountNumber')
        .notEmpty()
        .withMessage('toAccountNumber is required');
    next();
}, validator_1.default, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    yield rateLimit4transactionInProgress_1.default({
        typeOf: cinerino.factory.transactionType.PlaceOrder,
        id: req.params.transactionId
    })(req, res, next);
}), (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    yield lockTransaction_1.default({
        typeOf: cinerino.factory.transactionType.PlaceOrder,
        id: req.params.transactionId
    })(req, res, next);
}), (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const now = new Date();
        const ownershipInfoRepo = new cinerino.repository.OwnershipInfo(mongoose.connection);
        const programMemberships = yield ownershipInfoRepo.search({
            typeOfGood: {
                typeOf: 'ProgramMembership'
            },
            ownedBy: { id: req.user.sub },
            ownedFrom: now,
            ownedThrough: now
        });
        const pecorinoPaymentAward = programMemberships.reduce((a, b) => {
            return [...a, ...(Array.isArray(b.typeOfGood.award) ? b.typeOfGood.award : [])];
        }, [])
            .find((a) => a === POINT_AWARD);
        if (pecorinoPaymentAward === undefined) {
            throw new cinerino.factory.errors.Forbidden('Membership program requirements not satisfied');
        }
        const action = yield cinerino.service.transaction.placeOrderInProgress.action.authorize.award.point.create({
            agent: { id: req.user.sub },
            transaction: { id: req.params.transactionId },
            object: {
                amount: Number(req.body.amount),
                toAccountNumber: req.body.toAccountNumber,
                notes: req.body.notes
            }
        })({
            action: new cinerino.repository.Action(mongoose.connection),
            ownershipInfo: new cinerino.repository.OwnershipInfo(mongoose.connection),
            project: new cinerino.repository.Project(mongoose.connection),
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
 * ポイントインセンティブ承認アクション取消
 */
placeOrder4cinemasunshineRouter.delete('/:transactionId/actions/authorize/award/pecorino/:actionId', permitScopes_1.default(['customer', 'transactions']), validator_1.default, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    yield rateLimit4transactionInProgress_1.default({
        typeOf: cinerino.factory.transactionType.PlaceOrder,
        id: req.params.transactionId
    })(req, res, next);
}), (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    yield lockTransaction_1.default({
        typeOf: cinerino.factory.transactionType.PlaceOrder,
        id: req.params.transactionId
    })(req, res, next);
}), (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        yield cinerino.service.transaction.placeOrderInProgress.action.authorize.award.point.cancel({
            agent: { id: req.user.sub },
            transaction: { id: req.params.transactionId },
            id: req.params.actionId
        })({
            action: new cinerino.repository.Action(mongoose.connection),
            project: new cinerino.repository.Project(mongoose.connection),
            transaction: new cinerino.repository.Transaction(mongoose.connection)
        });
        res.status(http_status_1.NO_CONTENT)
            .end();
    }
    catch (error) {
        next(error);
    }
}));
placeOrder4cinemasunshineRouter.post('/:transactionId/confirm', permitScopes_1.default(['customer', 'transactions']), validator_1.default, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    yield rateLimit4transactionInProgress_1.default({
        typeOf: cinerino.factory.transactionType.PlaceOrder,
        id: req.params.transactionId
    })(req, res, next);
}), (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    yield lockTransaction_1.default({
        typeOf: cinerino.factory.transactionType.PlaceOrder,
        id: req.params.transactionId
    })(req, res, next);
}), (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const orderDate = new Date();
        // 互換性維持のため、テンプレートオプションを変換
        if (req.body.email === undefined) {
            req.body.email = {};
        }
        if (req.body.emailTemplate !== undefined) {
            req.body.email.template = req.body.emailTemplate;
        }
        const { order } = yield cinerino.service.transaction.placeOrderInProgress.confirm(Object.assign({}, req.body, { project: req.project, id: req.params.transactionId, agent: { id: req.user.sub }, result: {
                order: {
                    orderDate: orderDate,
                    confirmationNumber: (params) => {
                        const firstOffer = params.acceptedOffers[0];
                        // COAに適合させるため、座席予約の場合、確認番号をCOA予約番号に強制変換
                        if (firstOffer !== undefined
                            && firstOffer.itemOffered.typeOf === cinerino.factory.chevre.reservationType.EventReservation) {
                            return String(firstOffer.itemOffered.reservationNumber);
                        }
                        else {
                            return params.confirmationNumber;
                        }
                    }
                }
            }, sendEmailMessage: (req.body.sendEmailMessage === true) ? true : false }))({
            action: new cinerino.repository.Action(mongoose.connection),
            transaction: new cinerino.repository.Transaction(mongoose.connection),
            orderNumber: new cinerino.repository.OrderNumber(redis.getClient()),
            seller: new cinerino.repository.Seller(mongoose.connection)
        });
        debug('transaction confirmed', order);
        // 非同期でタスクエクスポート(APIレスポンスタイムに影響を与えないように)
        // tslint:disable-next-line:no-floating-promises
        cinerino.service.transaction.placeOrder.exportTasks({
            project: undefined,
            status: cinerino.factory.transactionStatusType.Confirmed
        })({
            task: new cinerino.repository.Task(mongoose.connection),
            transaction: new cinerino.repository.Transaction(mongoose.connection)
        })
            .then((tasks) => __awaiter(this, void 0, void 0, function* () {
            // タスクがあればすべて実行
            if (Array.isArray(tasks)) {
                yield Promise.all(tasks.map((task) => __awaiter(this, void 0, void 0, function* () {
                    yield cinerino.service.task.executeByName(task)({
                        connection: mongoose.connection,
                        redisClient: redis.getClient()
                    });
                })));
            }
        }));
        res.status(http_status_1.CREATED)
            .json(order);
    }
    catch (error) {
        next(error);
    }
}));
exports.default = placeOrder4cinemasunshineRouter;
