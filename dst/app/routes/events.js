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
 * イベントルーター
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
const eventsRouter = express_1.Router();
/**
 * イベント検索
 */
eventsRouter.get('', permitScopes_1.default(['events.*', 'events.read']), rateLimit_1.default, 
// 互換性維持のため
(req, _, next) => {
    if (typeof req.query.typeOf !== 'string') {
        req.query.typeOf = cinerino.factory.chevre.eventType.ScreeningEvent;
    }
    next();
}, ...[
    express_validator_1.query('inSessionFrom')
        .optional()
        .isISO8601()
        .toDate(),
    express_validator_1.query('inSessionThrough')
        .optional()
        .isISO8601()
        .toDate(),
    express_validator_1.query('startFrom')
        .optional()
        .isISO8601()
        .toDate(),
    express_validator_1.query('startThrough')
        .optional()
        .isISO8601()
        .toDate(),
    express_validator_1.query('endFrom')
        .optional()
        .isISO8601()
        .toDate(),
    express_validator_1.query('endThrough')
        .optional()
        .isISO8601()
        .toDate(),
    express_validator_1.query('offers.availableFrom')
        .optional()
        .isISO8601()
        .toDate(),
    express_validator_1.query('offers.availableThrough')
        .optional()
        .isISO8601()
        .toDate(),
    express_validator_1.query('offers.validFrom')
        .optional()
        .isISO8601()
        .toDate(),
    express_validator_1.query('offers.validThrough')
        .optional()
        .isISO8601()
        .toDate()
], validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const eventService = new cinerino.chevre.service.Event({
            endpoint: cinerino.credentials.chevre.endpoint,
            auth: chevreAuthClient
        });
        const searchConditions = Object.assign(Object.assign({}, req.query), { project: { ids: [req.project.id] }, 
            // tslint:disable-next-line:no-magic-numbers
            limit: (req.query.limit !== undefined) ? Math.min(req.query.limit, 100) : undefined, page: (req.query.page !== undefined) ? Math.max(req.query.page, 1) : undefined });
        const searchEventsResult = yield eventService.search(searchConditions);
        res.json(searchEventsResult.data);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * IDでイベント検索
 */
eventsRouter.get('/:id', permitScopes_1.default(['events.*', 'events.read']), rateLimit_1.default, validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        let event;
        const eventService = new cinerino.chevre.service.Event({
            endpoint: cinerino.credentials.chevre.endpoint,
            auth: chevreAuthClient
        });
        event = yield eventService.findById({ id: req.params.id });
        res.json(event);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * イベント部分更新
 */
eventsRouter.patch('/:id', permitScopes_1.default(['events.*', 'events.update']), rateLimit_1.default, validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const eventService = new cinerino.chevre.service.Event({
            endpoint: cinerino.credentials.chevre.endpoint,
            auth: chevreAuthClient
        });
        const event = yield eventService.findById({ id: req.params.id });
        yield eventService.updatePartially({
            id: event.id,
            attributes: Object.assign({ 
                // ...event,
                typeOf: event.typeOf }, (typeof req.body.eventStatus === 'string') ? { eventStatus: req.body.eventStatus } : undefined)
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
 * イベントに対するオファー検索
 */
eventsRouter.get('/:id/offers', permitScopes_1.default(['events.*', 'events.read']), rateLimit_1.default, validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const projectRepo = new cinerino.repository.Project(mongoose.connection);
        const offers = yield cinerino.service.offer.searchEventOffers({
            project: req.project,
            event: { id: req.params.id }
        })({
            project: projectRepo
        });
        res.json(offers);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * イベントに対する券種オファー検索
 */
// tslint:disable-next-line:use-default-type-parameter
eventsRouter.get('/:id/offers/ticket', permitScopes_1.default(['events.*', 'events.read']), rateLimit_1.default, ...[
    express_validator_1.query('seller')
        .not()
        .isEmpty()
        .withMessage(() => 'required'),
    express_validator_1.query('store')
        .not()
        .isEmpty()
        .withMessage(() => 'required')
], validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const projectRepo = new cinerino.repository.Project(mongoose.connection);
        const offers = yield cinerino.service.offer.searchEventTicketOffers(Object.assign({ project: req.project, event: { id: req.params.id }, seller: req.query.seller, store: req.query.store }, (req.query.movieTicket !== undefined && req.query.movieTicket !== null)
            ? { movieTicket: req.query.movieTicket }
            : {}))({
            project: projectRepo
        });
        res.json(offers);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * イベントに対する座席検索
 */
eventsRouter.get('/:id/seats', permitScopes_1.default(['events.*', 'events.read']), rateLimit_1.default, validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const eventService = new cinerino.chevre.service.Event({
            endpoint: cinerino.credentials.chevre.endpoint,
            auth: chevreAuthClient
        });
        const seats = yield eventService.searchSeats(Object.assign(Object.assign({}, req.query), { id: req.params.id }));
        res.json(seats.data);
    }
    catch (error) {
        next(error);
    }
}));
exports.default = eventsRouter;
