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
        const projectRepo = new cinerino.repository.Project(mongoose.connection);
        const project = yield projectRepo.findById({ id: req.project.id });
        if (project.settings === undefined) {
            throw new cinerino.factory.errors.ServiceUnavailable('Project settings undefined');
        }
        if (project.settings.chevre === undefined) {
            throw new cinerino.factory.errors.ServiceUnavailable('Project settings not found');
        }
        // クエリをそのままChevre検索へパス
        const reservationService = new cinerino.chevre.service.Reservation({
            endpoint: project.settings.chevre.endpoint,
            auth: chevreAuthClient
        });
        const searchResult = yield reservationService.search(Object.assign(Object.assign({}, req.query), { project: { ids: [req.project.id] }, typeOf: cinerino.factory.chevre.reservationType.EventReservation }));
        // res.set('X-Total-Count', searchResult.totalCount.toString());
        res.json(searchResult.data);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * ストリーミングダウンロード
 */
reservationsRouter.get('/download', permitScopes_1.default([]), rateLimit_1.default, validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const projectRepo = new cinerino.repository.Project(mongoose.connection);
        const project = yield projectRepo.findById({ id: req.project.id });
        if (project.settings === undefined) {
            throw new cinerino.factory.errors.ServiceUnavailable('Project settings undefined');
        }
        if (project.settings.chevre === undefined) {
            throw new cinerino.factory.errors.ServiceUnavailable('Project settings not found');
        }
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
 * トークンで予約照会
 */
reservationsRouter.post('/eventReservation/screeningEvent/findByToken', permitScopes_1.default(['reservations.read', 'reservations.findByToken']), rateLimit_1.default, ...[
    express_validator_1.body('token')
        .not()
        .isEmpty()
        .withMessage((_, __) => 'required')
], validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const projectRepo = new cinerino.repository.Project(mongoose.connection);
        const project = yield projectRepo.findById({ id: req.project.id });
        if (project.settings === undefined) {
            throw new cinerino.factory.errors.ServiceUnavailable('Project settings undefined');
        }
        if (project.settings.chevre === undefined) {
            throw new cinerino.factory.errors.ServiceUnavailable('Project settings not found');
        }
        const payload = yield cinerino.service.code.verifyToken({
            project: req.project,
            agent: req.agent,
            token: req.body.token,
            secret: process.env.TOKEN_SECRET,
            issuer: [process.env.RESOURCE_SERVER_IDENTIFIER]
        })({ action: new cinerino.repository.Action(mongoose.connection) });
        const ownershipInfoRepo = new cinerino.repository.OwnershipInfo(mongoose.connection);
        // 所有権検索
        const ownershipInfo = yield ownershipInfoRepo.findById({
            id: payload.id
        });
        const typeOfGood = ownershipInfo.typeOfGood;
        if (typeOfGood.typeOf !== cinerino.factory.chevre.reservationType.EventReservation) {
            throw new cinerino.factory.errors.Argument('token', 'Not reservation');
        }
        // 予約検索
        const reservationService = new cinerino.chevre.service.Reservation({
            endpoint: project.settings.chevre.endpoint,
            auth: chevreAuthClient
        });
        const reservation = yield reservationService.findById({
            id: typeOfGood.id
        });
        // 入場
        yield reservationService.attendScreeningEvent(reservation);
        res.json(Object.assign(Object.assign({}, ownershipInfo), { typeOfGood: reservation }));
    }
    catch (error) {
        next(error);
    }
}));
/**
 * 発券
 */
reservationsRouter.put('/checkedIn', permitScopes_1.default(['reservations.findByToken']), validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        const projectRepo = new cinerino.repository.Project(mongoose.connection);
        const project = yield projectRepo.findById({ id: req.project.id });
        if (typeof ((_b = (_a = project.settings) === null || _a === void 0 ? void 0 : _a.chevre) === null || _b === void 0 ? void 0 : _b.endpoint) !== 'string') {
            throw new cinerino.factory.errors.ServiceUnavailable('Project settings not satisfied');
        }
        const reservationService = new cinerino.chevre.service.Reservation({
            endpoint: project.settings.chevre.endpoint,
            auth: chevreAuthClient
        });
        yield reservationService.checkInScreeningEventReservations(req.body);
        res.status(http_status_1.NO_CONTENT)
            .end();
    }
    catch (error) {
        next(error);
    }
}));
/**
 * 入場
 */
reservationsRouter.put('/:id/attended', permitScopes_1.default(['reservations.findByToken']), validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _c, _d;
    try {
        const projectRepo = new cinerino.repository.Project(mongoose.connection);
        const project = yield projectRepo.findById({ id: req.project.id });
        if (typeof ((_d = (_c = project.settings) === null || _c === void 0 ? void 0 : _c.chevre) === null || _d === void 0 ? void 0 : _d.endpoint) !== 'string') {
            throw new cinerino.factory.errors.ServiceUnavailable('Project settings not satisfied');
        }
        const reservationService = new cinerino.chevre.service.Reservation({
            endpoint: project.settings.chevre.endpoint,
            auth: chevreAuthClient
        });
        yield reservationService.attendScreeningEvent({ id: req.params.id });
        res.status(http_status_1.NO_CONTENT)
            .end();
    }
    catch (error) {
        next(error);
    }
}));
exports.default = reservationsRouter;
