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
 * 予約ルーター
 */
const cinerino = require("@cinerino/domain");
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const http_status_1 = require("http-status");
const moment = require("moment");
const mongoose = require("mongoose");
const permitScopes_1 = require("../middlewares/permitScopes");
const rateLimit_1 = require("../middlewares/rateLimit");
const validator_1 = require("../middlewares/validator");
const chevreAuthClient = new cinerino.chevre.auth.ClientCredentials({
    domain: process.env.CHEVRE_AUTHORIZE_SERVER_DOMAIN,
    clientId: process.env.CHEVRE_CLIENT_ID,
    clientSecret: process.env.CHEVRE_CLIENT_SECRET,
    scopes: [],
    state: ''
});
const reservationsRouter = express_1.Router();
/**
 * 管理者として予約検索
 */
reservationsRouter.get('', permitScopes_1.default(['reservations.*', 'reservations.read']), rateLimit_1.default, ...[
    express_validator_1.query('bookingFrom')
        .optional()
        .isISO8601()
        .toDate(),
    express_validator_1.query('bookingThrough')
        .optional()
        .isISO8601()
        .toDate(),
    express_validator_1.query('modifiedFrom')
        .optional()
        .isISO8601()
        .toDate(),
    express_validator_1.query('modifiedThrough')
        .optional()
        .isISO8601()
        .toDate()
], validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // クエリをそのままChevre検索へパス
        const reservationService = new cinerino.chevre.service.Reservation({
            endpoint: cinerino.credentials.chevre.endpoint,
            auth: chevreAuthClient
        });
        const searchResult = yield reservationService.search(Object.assign(Object.assign({}, req.query), { project: { ids: [req.project.id] }, typeOf: cinerino.factory.chevre.reservationType.EventReservation }));
        res.json(searchResult.data);
    }
    catch (error) {
        error = cinerino.errorHandler.handleChevreError(error);
        next(error);
    }
}));
/**
 * ストリーミングダウンロード
 */
reservationsRouter.get('/download', permitScopes_1.default([]), rateLimit_1.default, validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // クエリをそのままChevre検索へパス
        const reservationService = new cinerino.chevre.service.Reservation({
            endpoint: process.env.CHEVRE_STREAMING_API_ENDPOINT,
            auth: chevreAuthClient
        });
        const stream = yield reservationService.download(Object.assign(Object.assign({}, req.query), { project: { ids: [req.project.id] } }));
        res.type(`${req.query.format}; charset=utf-8`);
        stream.pipe(res);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * トークンで予約を使用する
 */
reservationsRouter.post('/use', permitScopes_1.default(['reservations.read', 'reservations.findByToken']), rateLimit_1.default, ...[
    express_validator_1.body('instrument.token')
        .not()
        .isEmpty()
        .withMessage(() => 'required')
        .isString(),
    express_validator_1.body('object.id')
        .not()
        .isEmpty()
        .withMessage(() => 'required')
        .isString()
], validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        const token = (_a = req.body.instrument) === null || _a === void 0 ? void 0 : _a.token;
        const reservationId = (_b = req.body.object) === null || _b === void 0 ? void 0 : _b.id;
        const payload = yield cinerino.service.code.verifyToken({
            project: req.project,
            agent: req.agent,
            token: token,
            secret: process.env.TOKEN_SECRET,
            issuer: [process.env.RESOURCE_SERVER_IDENTIFIER]
        })({});
        switch (payload.typeOf) {
            case 'Order':
                const orderRepo = new cinerino.repository.Order(mongoose.connection);
                // 注文検索
                const order = yield orderRepo.findByOrderNumber({ orderNumber: payload.orderNumber });
                const acceptedOffer = order.acceptedOffers.find((offer) => {
                    return offer.itemOffered.typeOf === cinerino.factory.chevre.reservationType.EventReservation
                        && offer.itemOffered.id === reservationId;
                });
                if (acceptedOffer === undefined) {
                    throw new cinerino.factory.errors.NotFound('AcceptedOffer');
                }
                yield useReservation({
                    project: { id: req.project.id },
                    agent: req.agent,
                    object: { id: acceptedOffer.itemOffered.id },
                    instrument: { token }
                })({ action: new cinerino.repository.Action(mongoose.connection) });
                res.status(http_status_1.NO_CONTENT)
                    .end();
                break;
            default:
                throw new cinerino.factory.errors.NotImplemented(`Payload type ${payload.typeOf} not implemented`);
        }
    }
    catch (error) {
        error = cinerino.errorHandler.handleChevreError(error);
        next(error);
    }
}));
/**
 * トークンで予約照会
 * @deprecated Use /reservations/use
 */
reservationsRouter.post('/eventReservation/screeningEvent/findByToken', permitScopes_1.default(['reservations.read', 'reservations.findByToken']), rateLimit_1.default, ...[
    express_validator_1.body('token')
        .not()
        .isEmpty()
        .withMessage(() => 'required')
], validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const actionRepo = new cinerino.repository.Action(mongoose.connection);
        const payload = yield cinerino.service.code.verifyToken({
            project: req.project,
            agent: req.agent,
            token: req.body.token,
            secret: process.env.TOKEN_SECRET,
            issuer: [process.env.RESOURCE_SERVER_IDENTIFIER]
        })({ action: actionRepo });
        const ownershipInfoRepo = new cinerino.repository.OwnershipInfo(mongoose.connection);
        // 所有権検索
        const ownershipInfo = yield ownershipInfoRepo.findById({
            id: payload.id
        });
        const typeOfGood = ownershipInfo.typeOfGood;
        if (typeOfGood.typeOf !== cinerino.factory.chevre.reservationType.EventReservation) {
            throw new cinerino.factory.errors.Argument('token', 'Not reservation');
        }
        yield useReservation({
            project: { id: req.project.id },
            agent: req.agent,
            object: { id: typeOfGood.id },
            instrument: { token: req.body.token }
        })({ action: actionRepo });
        // const reservation = useAction.object[0];
        // レスポンスをフロントアプリ側で使用していなかったので削除
        // res.json({ ...ownershipInfo, typeOfGood: reservation });
        res.json({});
    }
    catch (error) {
        error = cinerino.errorHandler.handleChevreError(error);
        next(error);
    }
}));
function useReservation(params) {
    return (repos) => __awaiter(this, void 0, void 0, function* () {
        // 予約検索
        const reservationService = new cinerino.chevre.service.Reservation({
            endpoint: cinerino.credentials.chevre.endpoint,
            auth: chevreAuthClient
        });
        const reservation = yield reservationService.findById({
            id: params.object.id
        });
        // 入場
        // 予約使用アクションを追加
        const actionAttributes = {
            project: { typeOf: cinerino.factory.chevre.organizationType.Project, id: params.project.id },
            typeOf: cinerino.factory.actionType.UseAction,
            agent: params.agent,
            instrument: params.instrument,
            object: [reservation]
            // purpose: params.purpose
        };
        const action = yield repos.action.start(actionAttributes);
        try {
            yield reservationService.attendScreeningEvent({ id: reservation.id });
        }
        catch (error) {
            // actionにエラー結果を追加
            try {
                const actionError = Object.assign(Object.assign({}, error), { message: error.message, name: error.name });
                yield repos.action.giveUp({ typeOf: actionAttributes.typeOf, id: action.id, error: actionError });
            }
            catch (__) {
                // 失敗したら仕方ない
            }
            throw error;
        }
        return repos.action.complete({ typeOf: action.typeOf, id: action.id, result: {} });
    });
}
/**
 * 予約取消
 */
reservationsRouter.put('/cancel', permitScopes_1.default(['reservations.*', 'reservations.cancel']), validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const cancelReservationService = new cinerino.chevre.service.transaction.CancelReservation({
            endpoint: cinerino.credentials.chevre.endpoint,
            auth: chevreAuthClient
        });
        yield cancelReservationService.startAndConfirm({
            project: { typeOf: req.project.typeOf, id: req.project.id },
            typeOf: cinerino.factory.chevre.transactionType.CancelReservation,
            expires: moment()
                .add(1, 'minute')
                .toDate(),
            agent: Object.assign({}, req.body.agent),
            object: Object.assign({}, req.body.object),
            potentialActions: Object.assign({}, req.body.potentialActions)
        });
        res.status(http_status_1.NO_CONTENT)
            .end();
    }
    catch (error) {
        error = cinerino.errorHandler.handleChevreError(error);
        next(error);
    }
}));
/**
 * 発券
 */
reservationsRouter.put('/checkedIn', permitScopes_1.default(['reservations.findByToken']), validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const reservationService = new cinerino.chevre.service.Reservation({
            endpoint: cinerino.credentials.chevre.endpoint,
            auth: chevreAuthClient
        });
        yield reservationService.checkInScreeningEventReservations(req.body);
        res.status(http_status_1.NO_CONTENT)
            .end();
    }
    catch (error) {
        error = cinerino.errorHandler.handleChevreError(error);
        next(error);
    }
}));
/**
 * 入場
 */
reservationsRouter.put('/:id/attended', permitScopes_1.default(['reservations.findByToken']), validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const actionRepo = new cinerino.repository.Action(mongoose.connection);
        yield useReservation({
            project: { id: req.project.id },
            agent: req.agent,
            object: { id: req.params.id }
        })({ action: actionRepo });
        res.status(http_status_1.NO_CONTENT)
            .end();
    }
    catch (error) {
        error = cinerino.errorHandler.handleChevreError(error);
        next(error);
    }
}));
exports.default = reservationsRouter;
