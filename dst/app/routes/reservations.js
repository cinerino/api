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
    // どのトークンを使って
    express_validator_1.body('instrument.token')
        .not()
        .isEmpty()
        .withMessage(() => 'required')
        .isString(),
    // どの予約を
    express_validator_1.body('object.id')
        .not()
        .isEmpty()
        .withMessage(() => 'required')
        .isString()
], validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    try {
        const includesActionId = req.body.includesActionId === '1';
        const token = (_a = req.body.instrument) === null || _a === void 0 ? void 0 : _a.token;
        const reservationId = (_b = req.body.object) === null || _b === void 0 ? void 0 : _b.id;
        const locationIdentifier = (_c = req.body.location) === null || _c === void 0 ? void 0 : _c.identifier;
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
                const chevreUseAction = yield useReservation({
                    project: { id: req.project.id },
                    agent: req.agent,
                    object: { id: acceptedOffer.itemOffered.id },
                    instrument: { token },
                    location: { identifier: (typeof locationIdentifier === 'string') ? locationIdentifier : undefined }
                })({ action: new cinerino.repository.Action(mongoose.connection) });
                // 指定があれば、アクションIDをレスポンスに含める
                if (includesActionId && typeof (chevreUseAction === null || chevreUseAction === void 0 ? void 0 : chevreUseAction.id) === 'string') {
                    res.json({ id: chevreUseAction.id });
                }
                else {
                    res.status(http_status_1.NO_CONTENT)
                        .end();
                }
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
function useReservation(params) {
    return (repos) => __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
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
        let chevreUseAction;
        try {
            const useResult = yield reservationService.use({
                agent: params.agent,
                object: { id: reservation.id },
                instrument: { token: (typeof ((_a = params.instrument) === null || _a === void 0 ? void 0 : _a.token) === 'string') ? params.instrument.token : undefined },
                location: { identifier: (typeof ((_b = params.location) === null || _b === void 0 ? void 0 : _b.identifier) === 'string') ? params.location.identifier : undefined }
            });
            if (useResult !== undefined) {
                chevreUseAction = useResult;
            }
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
        yield repos.action.complete({ typeOf: action.typeOf, id: action.id, result: {} });
        return chevreUseAction;
    });
}
/**
 * 予約に対する使用アクションを検索する
 */
// tslint:disable-next-line:use-default-type-parameter
reservationsRouter.get('/:id/actions/use', permitScopes_1.default(['reservations.read']), rateLimit_1.default, ...[
    express_validator_1.query('startFrom')
        .optional()
        .isISO8601()
        .toDate(),
    express_validator_1.query('startThrough')
        .optional()
        .isISO8601()
        .toDate()
], validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // const now = new Date();
        const reservationId = req.params.id;
        const actionRepo = new cinerino.repository.Action(mongoose.connection);
        // 予約使用アクションを検索
        const searchConditions = {
            // ページング未実装、いったん100限定でも要件は十分満たされるか
            // tslint:disable-next-line:no-magic-numbers
            limit: 100,
            sort: { startDate: cinerino.factory.sortType.Descending },
            project: { id: { $eq: req.project.id } },
            typeOf: cinerino.factory.actionType.UseAction,
            object: {
                typeOf: { $in: [cinerino.factory.chevre.reservationType.EventReservation] },
                id: { $in: [reservationId] }
            },
            startFrom: (req.query.startFrom instanceof Date)
                ? req.query.startFrom
                : undefined,
            startThrough: (req.query.startThrough instanceof Date)
                ? req.query.startThrough
                : undefined
        };
        const actions = yield actionRepo.search(searchConditions);
        res.json(actions);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * chevre予約使用アクション取消
 */
// tslint:disable-next-line:use-default-type-parameter
reservationsRouter.put(`/:id/actions/use/:actionId/${cinerino.factory.actionStatusType.CanceledActionStatus}`, 
// ひとまずuserロールで実行できるように↓
permitScopes_1.default(['projects.read']), rateLimit_1.default, ...[], validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const actionService = new cinerino.chevre.service.Action({
            endpoint: cinerino.credentials.chevre.endpoint,
            auth: chevreAuthClient
        });
        yield actionService.cancelById({
            id: req.params.actionId
        });
        res.status(http_status_1.NO_CONTENT)
            .end();
    }
    catch (error) {
        next(error);
    }
}));
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
exports.default = reservationsRouter;
