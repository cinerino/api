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
    var _a;
    try {
        const projectRepo = new cinerino.repository.Project(mongoose.connection);
        const project = yield projectRepo.findById({ id: req.project.id });
        const useRedisEventItemAvailabilityRepo = ((_a = project.settings) === null || _a === void 0 ? void 0 : _a.useRedisEventItemAvailabilityRepo) === true;
        const searchConditions = Object.assign(Object.assign({}, req.query), { project: { ids: [req.project.id] }, 
            // tslint:disable-next-line:no-magic-numbers
            limit: (req.query.limit !== undefined) ? Math.min(req.query.limit, 100) : undefined, page: (req.query.page !== undefined) ? Math.max(req.query.page, 1) : undefined });
        const searchEventsResult = yield cinerino.service.offer.searchEvents({
            project: req.project,
            conditions: searchConditions
        })({
            project: projectRepo
        });
        // Cinemasunshine対応
        if (useRedisEventItemAvailabilityRepo) {
            // searchEventsResult.data = searchEventsResult.data.map((e) => {
            //     // シネマサンシャインではavailability属性を利用しているため、残席数から空席率情報を追加
            //     const offers = (e.offers !== undefined)
            //         ? {
            //             ...e.offers,
            //             availability: 100
            //         }
            //         : undefined;
            //     if (offers !== undefined
            //         && typeof e.remainingAttendeeCapacity === 'number'
            //         && typeof e.maximumAttendeeCapacity === 'number') {
            //         // tslint:disable-next-line:no-magic-numbers
            //         offers.availability = Math.floor(Number(e.remainingAttendeeCapacity) / Number(e.maximumAttendeeCapacity) * 100);
            //     }
            //     return {
            //         ...e,
            //         ...(offers !== undefined)
            //             ? {
            //                 offer: offers, // 本来不要だが、互換性維持のため
            //                 offers: offers
            //             }
            //             : undefined
            //     };
            // });
        }
        if (typeof searchEventsResult.totalCount === 'number') {
            res.set('X-Total-Count', searchEventsResult.totalCount.toString());
        }
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
    var _b, _c;
    try {
        const projectRepo = new cinerino.repository.Project(mongoose.connection);
        let event;
        const project = yield projectRepo.findById({ id: req.project.id });
        const useRedisEventItemAvailabilityRepo = ((_b = project.settings) === null || _b === void 0 ? void 0 : _b.useRedisEventItemAvailabilityRepo) === true;
        if (((_c = project.settings) === null || _c === void 0 ? void 0 : _c.chevre) === undefined) {
            throw new cinerino.factory.errors.ServiceUnavailable('Project settings not satisfied');
        }
        const eventService = new cinerino.chevre.service.Event({
            endpoint: project.settings.chevre.endpoint,
            auth: chevreAuthClient
        });
        event = yield eventService.findById({ id: req.params.id });
        // Cinemasunshine対応
        if (useRedisEventItemAvailabilityRepo) {
            // シネマサンシャインではavailability属性を利用しているため、残席数から空席率情報を追加
            // const offers = (event.offers !== undefined)
            //     ? {
            //         ...event.offers,
            //         availability: 100
            //     }
            //     : undefined;
            // if (offers !== undefined
            //     && typeof event.remainingAttendeeCapacity === 'number'
            //     && typeof event.maximumAttendeeCapacity === 'number') {
            //     offers.availability =
            //         // tslint:disable-next-line:no-magic-numbers
            //         Math.floor(Number(event.remainingAttendeeCapacity) / Number(event.maximumAttendeeCapacity) * 100);
            // }
            // event = {
            //     ...event,
            //     ...(offers !== undefined)
            //         ? {
            //             offer: offers, // 本来不要だが、互換性維持のため
            //             offers: offers
            //         }
            //         : undefined
            // };
        }
        res.json(event);
    }
    catch (error) {
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
        const sellerRepo = new cinerino.repository.Seller(mongoose.connection);
        const offers = yield cinerino.service.offer.searchEventTicketOffers(Object.assign({ project: req.project, event: { id: req.params.id }, seller: req.query.seller, store: req.query.store }, (req.query.movieTicket !== undefined && req.query.movieTicket !== null)
            ? { movieTicket: req.query.movieTicket }
            : {}))({
            project: projectRepo,
            seller: sellerRepo
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
    var _d;
    try {
        const projectRepo = new cinerino.repository.Project(mongoose.connection);
        const project = yield projectRepo.findById({ id: req.project.id });
        if (((_d = project.settings) === null || _d === void 0 ? void 0 : _d.chevre) === undefined) {
            throw new cinerino.factory.errors.ServiceUnavailable('Project settings not satisfied');
        }
        const eventService = new cinerino.chevre.service.Event({
            endpoint: project.settings.chevre.endpoint,
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
