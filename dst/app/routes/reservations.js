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
// tslint:disable-next-line:no-submodule-imports
const check_1 = require("express-validator/check");
const moment = require("moment");
const mongoose = require("mongoose");
const authentication_1 = require("../middlewares/authentication");
const permitScopes_1 = require("../middlewares/permitScopes");
const validator_1 = require("../middlewares/validator");
const chevreAuthClient = new cinerino.chevre.auth.ClientCredentials({
    domain: process.env.CHEVRE_AUTHORIZE_SERVER_DOMAIN,
    clientId: process.env.CHEVRE_CLIENT_ID,
    clientSecret: process.env.CHEVRE_CLIENT_SECRET,
    scopes: [],
    state: ''
});
const reservationsRouter = express_1.Router();
reservationsRouter.use(authentication_1.default);
/**
 * 管理者として予約検索
 */
reservationsRouter.get('', permitScopes_1.default([]), (req, _, next) => {
    const now = moment();
    if (typeof req.query.modifiedThrough !== 'string') {
        req.query.modifiedThrough = moment(now)
            .toISOString();
    }
    if (typeof req.query.modifiedFrom !== 'string') {
        req.query.modifiedFrom = moment(now)
            // tslint:disable-next-line:no-magic-numbers
            .add(-6, 'months') // とりあえず直近6カ月をデフォルト動作に設定
            .toISOString();
    }
    next();
}, ...[
    check_1.query('modifiedFrom')
        .not()
        .isEmpty()
        .isISO8601()
        .toDate(),
    check_1.query('modifiedThrough')
        .not()
        .isEmpty()
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
        res.set('X-Total-Count', searchResult.totalCount.toString());
        res.json(searchResult.data);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * 管理者として予約検索
 * @deprecated Use /reservations
 */
reservationsRouter.get('/eventReservation/screeningEvent', permitScopes_1.default([]), (req, _, next) => {
    const now = moment();
    if (typeof req.query.modifiedThrough !== 'string') {
        req.query.modifiedThrough = moment(now)
            .toISOString();
    }
    if (typeof req.query.modifiedFrom !== 'string') {
        req.query.modifiedFrom = moment(now)
            // tslint:disable-next-line:no-magic-numbers
            .add(-6, 'months') // とりあえず直近6カ月をデフォルト動作に設定
            .toISOString();
    }
    next();
}, ...[
    check_1.query('modifiedFrom')
        .not()
        .isEmpty()
        .isISO8601()
        .toDate(),
    check_1.query('modifiedThrough')
        .not()
        .isEmpty()
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
        res.set('X-Total-Count', searchResult.totalCount.toString());
        res.json(searchResult.data);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * トークンで予約照会
 */
reservationsRouter.post('/eventReservation/screeningEvent/findByToken', permitScopes_1.default(['tokens', 'tokens.read-only']), ...[
    check_1.body('token')
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
            issuer: process.env.RESOURCE_SERVER_IDENTIFIER
        })({ action: new cinerino.repository.Action(mongoose.connection) });
        const ownershipInfoRepo = new cinerino.repository.OwnershipInfo(mongoose.connection);
        const ownershipInfo = yield ownershipInfoRepo.search({
            typeOfGood: {
                typeOf: cinerino.factory.chevre.reservationType.EventReservation,
                id: payload.typeOfGood.id
            }
        })
            .then((infos) => {
            if (infos.length === 0) {
                throw new cinerino.factory.errors.NotFound('OwnershipInfo');
            }
            return infos[0];
        });
        const reservationService = new cinerino.chevre.service.Reservation({
            endpoint: project.settings.chevre.endpoint,
            auth: chevreAuthClient
        });
        const reservation = yield reservationService.findById({
            id: ownershipInfo.typeOfGood.id
        });
        // 入場
        yield reservationService.attendScreeningEvent(reservation);
        res.json(Object.assign(Object.assign({}, ownershipInfo), { typeOfGood: reservation }));
    }
    catch (error) {
        next(error);
    }
}));
exports.default = reservationsRouter;
