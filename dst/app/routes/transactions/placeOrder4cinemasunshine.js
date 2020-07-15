"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
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
const express_1 = require("express");
const http_status_1 = require("http-status");
const mongoose = require("mongoose");
const lockTransaction_1 = require("../../middlewares/lockTransaction");
const permitScopes_1 = require("../../middlewares/permitScopes");
const rateLimit4transactionInProgress_1 = require("../../middlewares/rateLimit4transactionInProgress");
const validator_1 = require("../../middlewares/validator");
const placeOrder4cinemasunshineRouter = express_1.Router();
/**
 * 座席仮予約
 */
placeOrder4cinemasunshineRouter.post('/:transactionId/actions/authorize/seatReservation', permitScopes_1.default(['transactions']), validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    yield rateLimit4transactionInProgress_1.default({
        typeOf: cinerino.factory.transactionType.PlaceOrder,
        id: req.params.transactionId
    })(req, res, next);
}), (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    yield lockTransaction_1.default({
        typeOf: cinerino.factory.transactionType.PlaceOrder,
        id: req.params.transactionId
    })(req, res, next);
}), (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const action = yield cinerino.service.offer.seatReservation4coa.create({
            project: req.project,
            object: {
                event: { id: req.body.eventIdentifier },
                acceptedOffer: req.body.offers
            },
            agent: { id: req.user.sub },
            transaction: { id: req.params.transactionId }
        })({
            action: new cinerino.repository.Action(mongoose.connection),
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
 * 座席仮予約削除
 */
placeOrder4cinemasunshineRouter.delete('/:transactionId/actions/authorize/seatReservation/:actionId', permitScopes_1.default(['transactions']), validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    yield rateLimit4transactionInProgress_1.default({
        typeOf: cinerino.factory.transactionType.PlaceOrder,
        id: req.params.transactionId
    })(req, res, next);
}), (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    yield lockTransaction_1.default({
        typeOf: cinerino.factory.transactionType.PlaceOrder,
        id: req.params.transactionId
    })(req, res, next);
}), (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield cinerino.service.offer.seatReservation4coa.cancel({
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
placeOrder4cinemasunshineRouter.patch('/:transactionId/actions/authorize/seatReservation/:actionId', permitScopes_1.default(['transactions']), validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    yield rateLimit4transactionInProgress_1.default({
        typeOf: cinerino.factory.transactionType.PlaceOrder,
        id: req.params.transactionId
    })(req, res, next);
}), (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    yield lockTransaction_1.default({
        typeOf: cinerino.factory.transactionType.PlaceOrder,
        id: req.params.transactionId
    })(req, res, next);
}), (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const action = yield cinerino.service.offer.seatReservation4coa.changeOffers({
            project: req.project,
            object: {
                event: { id: req.body.eventIdentifier },
                acceptedOffer: req.body.offers
            },
            agent: { id: req.user.sub },
            transaction: { id: req.params.transactionId },
            id: req.params.actionId
        })({
            action: new cinerino.repository.Action(mongoose.connection),
            project: new cinerino.repository.Project(mongoose.connection),
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
// placeOrder4cinemasunshineRouter.post(
//     '/:transactionId/actions/authorize/offer/programMembership',
//     permitScopes(['transactions']),
//     validator,
//     async (req, res, next) => {
//         await rateLimit4transactionInProgress({
//             typeOf: cinerino.factory.transactionType.PlaceOrder,
//             id: req.params.transactionId
//         })(req, res, next);
//     },
//     async (req, res, next) => {
//         await lockTransaction({
//             typeOf: cinerino.factory.transactionType.PlaceOrder,
//             id: req.params.transactionId
//         })(req, res, next);
//     },
//     async (_, res, next) => {
//         try {
// tslint:disable-next-line:no-suspicious-comment
//             // TODO 実装
//             res.status(CREATED)
//                 .json({});
//         } catch (error) {
//             next(error);
//         }
//     }
// );
/**
 * 会員プログラムオファー承認アクション取消
 */
// placeOrder4cinemasunshineRouter.delete(
//     '/:transactionId/actions/authorize/offer/programMembership/:actionId',
//     permitScopes(['transactions']),
//     validator,
//     async (req, res, next) => {
//         await rateLimit4transactionInProgress({
//             typeOf: cinerino.factory.transactionType.PlaceOrder,
//             id: req.params.transactionId
//         })(req, res, next);
//     },
//     async (req, res, next) => {
//         await lockTransaction({
//             typeOf: cinerino.factory.transactionType.PlaceOrder,
//             id: req.params.transactionId
//         })(req, res, next);
//     },
//     async (_, res, next) => {
//         try {
// tslint:disable-next-line:no-suspicious-comment
//             // TODO 実装
//             res.status(NO_CONTENT)
//                 .end();
//         } catch (error) {
//             next(error);
//         }
//     }
// );
/**
 * 前売券決済承認
 */
// placeOrder4cinemasunshineRouter.post(
//     '/:transactionId/actions/authorize/mvtk',
//     permitScopes(['transactions']),
//     validator,
//     async (req, res, next) => {
//         await rateLimit4transactionInProgress({
//             typeOf: cinerino.factory.transactionType.PlaceOrder,
//             id: req.params.transactionId
//         })(req, res, next);
//     },
//     async (req, res, next) => {
//         await lockTransaction({
//             typeOf: cinerino.factory.transactionType.PlaceOrder,
//             id: req.params.transactionId
//         })(req, res, next);
//     },
//     async (req, res, next) => {
//         try {
//             const authorizeObject = {
//                 typeOf: (typeof req.body.typeOf === 'string' && req.body.typeOf.length > 0)
//                     ? req.body.typeOf
//                     : cinerino.factory.paymentMethodType.MovieTicket,
//                 seatInfoSyncIn: {
//                     kgygishCd: req.body.seatInfoSyncIn?.kgygishCd,
//                     yykDvcTyp: req.body.seatInfoSyncIn?.yykDvcTyp,
//                     trkshFlg: req.body.seatInfoSyncIn?.trkshFlg,
//                     kgygishSstmZskyykNo: req.body.seatInfoSyncIn?.kgygishSstmZskyykNo,
//                     kgygishUsrZskyykNo: req.body.seatInfoSyncIn?.kgygishUsrZskyykNo,
//                     jeiDt: req.body.seatInfoSyncIn?.jeiDt,
//                     kijYmd: req.body.seatInfoSyncIn?.kijYmd,
//                     stCd: req.body.seatInfoSyncIn?.stCd,
//                     screnCd: req.body.seatInfoSyncIn?.screnCd,
//                     knyknrNoInfo: req.body.seatInfoSyncIn?.knyknrNoInfo,
//                     zskInfo: req.body.seatInfoSyncIn?.zskInfo,
//                     skhnCd: req.body.seatInfoSyncIn?.skhnCd
//                 }
//             };
//             const actions = await cinerino.service.payment.advancedTicket.authorize({
//                 project: req.project,
//                 agentId: req.user.sub,
//                 transactionId: req.params.transactionId,
//                 authorizeObject: authorizeObject
//             })({
//                 action: new cinerino.repository.Action(mongoose.connection),
//                 paymentMethod: new cinerino.repository.PaymentMethod(mongoose.connection),
//                 transaction: new cinerino.repository.Transaction(mongoose.connection)
//             });
//             res.status(CREATED)
//                 .json({
//                     // ムビチケ承認アクションが購入管理番号数分作成されるので、本来リストを返す必要があるが
//                     // シネマサンシャインでは、承認取消時にバックエンドでは何も処理していないので、いったんこれで回避
//                     id: actions[0].id
//                 });
//         } catch (error) {
//             next(error);
//         }
//     }
// );
/**
 * ムビチケ取消
 */
// placeOrder4cinemasunshineRouter.delete(
//     '/:transactionId/actions/authorize/mvtk/:actionId',
//     permitScopes(['transactions']),
//     validator,
//     async (req, res, next) => {
//         await rateLimit4transactionInProgress({
//             typeOf: cinerino.factory.transactionType.PlaceOrder,
//             id: req.params.transactionId
//         })(req, res, next);
//     },
//     async (req, res, next) => {
//         await lockTransaction({
//             typeOf: cinerino.factory.transactionType.PlaceOrder,
//             id: req.params.transactionId
//         })(req, res, next);
//     },
//     async (req, res, next) => {
//         try {
//             await cinerino.service.payment.advancedTicket.voidTransaction({
//                 agentId: req.user.sub,
//                 transactionId: req.params.transactionId,
//                 actionId: req.params.actionId
//             })({
//                 action: new cinerino.repository.Action(mongoose.connection),
//                 transaction: new cinerino.repository.Transaction(mongoose.connection)
//             });
//             res.status(NO_CONTENT)
//                 .end();
//         } catch (error) {
//             next(error);
//         }
//     }
// );
exports.default = placeOrder4cinemasunshineRouter;
