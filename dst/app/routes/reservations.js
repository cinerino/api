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
const permitScopes_1 = require("../middlewares/permitScopes");
const rateLimit_1 = require("../middlewares/rateLimit");
const validator_1 = require("../middlewares/validator");
const ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH = (process.env.ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH !== undefined)
    ? Number(process.env.ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH)
    // tslint:disable-next-line:no-magic-numbers
    : 256;
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
            auth: chevreAuthClient,
            project: { id: req.project.id }
        });
        const searchResult = yield reservationService.search(Object.assign(Object.assign({}, req.query), { project: { ids: [req.project.id] }, typeOf: cinerino.factory.chevre.reservationType.EventReservation }));
        // totalCount対応
        if (typeof searchResult.totalCount === 'number') {
            res.set('X-Total-Count', String(searchResult.totalCount));
        }
        res.json(searchResult.data);
    }
    catch (error) {
        error = cinerino.errorHandler.handleChevreError(error);
        next(error);
    }
}));
/**
 * トークンで予約を使用する
 */
reservationsRouter.post('/use', permitScopes_1.default(['reservations.read', 'reservations.findByToken']), rateLimit_1.default, ...[
    express_validator_1.body('agent.identifier')
        .optional()
        .isArray({ max: 10 }),
    express_validator_1.body('agent.identifier.*.name')
        .optional()
        .not()
        .isEmpty()
        .isString()
        .isLength({ max: ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH }),
    express_validator_1.body('agent.identifier.*.value')
        .optional()
        .not()
        .isEmpty()
        .isString()
        .isLength({ max: ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH }),
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
    var _a, _b, _c, _d;
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
                const orderService = new cinerino.chevre.service.Order({
                    endpoint: cinerino.credentials.chevre.endpoint,
                    auth: chevreAuthClient,
                    project: { id: req.project.id }
                });
                // 注文検索
                const order = yield orderService.findByOrderNumber({ orderNumber: payload.orderNumber });
                const acceptedOffer = order.acceptedOffers.find((offer) => {
                    return offer.itemOffered.typeOf === cinerino.factory.chevre.reservationType.EventReservation
                        && offer.itemOffered.id === reservationId;
                });
                if (acceptedOffer === undefined) {
                    throw new cinerino.factory.errors.NotFound('AcceptedOffer');
                }
                const chevreUseAction = yield useReservation({
                    project: { id: req.project.id },
                    agent: Object.assign(Object.assign({}, req.agent), { identifier: [
                            ...(Array.isArray(req.agent.identifier)) ? req.agent.identifier : [],
                            ...(Array.isArray((_d = req.body.agent) === null || _d === void 0 ? void 0 : _d.identifier))
                                ? req.body.agent.identifier.map((p) => {
                                    return { name: String(p.name), value: String(p.value) };
                                })
                                : []
                        ] }),
                    object: { id: acceptedOffer.itemOffered.id },
                    instrument: { token },
                    location: { identifier: (typeof locationIdentifier === 'string') ? locationIdentifier : undefined }
                })();
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
    return () => __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        // 予約検索
        const reservationService = new cinerino.chevre.service.Reservation({
            endpoint: cinerino.credentials.chevre.endpoint,
            auth: chevreAuthClient,
            project: { id: params.project.id }
        });
        const reservation = yield reservationService.findById({
            id: params.object.id
        });
        let chevreUseAction;
        try {
            // 入場
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
            throw error;
        }
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
        const reservationId = req.params.id;
        // Chevreで検索
        const reservationService = new cinerino.chevre.service.Reservation({
            endpoint: cinerino.credentials.chevre.endpoint,
            auth: req.chevreAuthClient,
            project: { id: req.project.id }
        });
        const searchActionsResult = yield reservationService.searchUseActions(Object.assign(Object.assign({}, req.query), { object: {
                id: { $eq: reservationId }
            } }));
        res.json(searchActionsResult.data);
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
        const cancelReservationService = new cinerino.chevre.service.assetTransaction.CancelReservation({
            endpoint: cinerino.credentials.chevre.endpoint,
            auth: chevreAuthClient,
            project: { id: req.project.id }
        });
        yield cancelReservationService.startAndConfirm({
            project: { typeOf: req.project.typeOf, id: req.project.id },
            typeOf: cinerino.factory.chevre.assetTransactionType.CancelReservation,
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
