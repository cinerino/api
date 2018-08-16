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
 * イベントルーター
 */
const cinerino = require("@cinerino/domain");
const express_1 = require("express");
const moment = require("moment");
// import * as redis from '../../redis';
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
const eventsRouter = express_1.Router();
eventsRouter.use(authentication_1.default);
eventsRouter.get('/screeningEvent', permitScopes_1.default(['aws.cognito.signin.user.admin', 'events', 'events.read-only']), (req, __, next) => {
    req.checkQuery('startFrom').optional().isISO8601().withMessage('startFrom must be ISO8601 timestamp');
    req.checkQuery('startThrough').optional().isISO8601().withMessage('startThrough must be ISO8601 timestamp');
    req.checkQuery('endFrom').optional().isISO8601().withMessage('endFrom must be ISO8601 timestamp');
    req.checkQuery('endThrough').optional().isISO8601().withMessage('endThrough must be ISO8601 timestamp');
    next();
}, validator_1.default, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const events = yield cinerino.service.event.searchScreeningEvents({
            name: req.query.name,
            startFrom: (req.query.startFrom !== undefined) ? moment(req.query.startFrom).toDate() : undefined,
            startThrough: (req.query.startThrough !== undefined) ? moment(req.query.startThrough).toDate() : undefined,
            endFrom: (req.query.endFrom !== undefined) ? moment(req.query.endFrom).toDate() : undefined,
            endThrough: (req.query.endThrough !== undefined) ? moment(req.query.endThrough).toDate() : undefined,
            eventStatuses: (Array.isArray(req.query.eventStatuses)) ? req.query.eventStatuses : undefined,
            superEventLocationIds: (Array.isArray(req.query.superEventLocationIds)) ? req.query.superEventLocationIds : undefined,
            workPerformedIds: (Array.isArray(req.query.workPerformedIds)) ? req.query.workPerformedIds : undefined
        })({
            event: new cinerino.repository.Event(cinerino.mongoose.connection)
            // itemAvailability: new cinerino.repository.itemAvailability.IndividualScreeningEvent(redis.getClient())
        });
        res.json(events);
    }
    catch (error) {
        next(error);
    }
}));
eventsRouter.get('/screeningEvent/:id', permitScopes_1.default(['aws.cognito.signin.user.admin', 'events', 'events.read-only']), validator_1.default, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const event = yield cinerino.service.event.findScreeningEventById(req.params.id)({
            event: new cinerino.repository.Event(cinerino.mongoose.connection)
            // itemAvailability: new cinerino.repository.itemAvailability.IndividualScreeningEvent(redis.getClient())
        });
        res.json(event);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * 上映イベントに対する券種検索
 */
eventsRouter.get('/screeningEvent/:id/ticketTypes', permitScopes_1.default(['aws.cognito.signin.user.admin', 'events', 'events.read-only']), validator_1.default, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const eventService = new cinerino.chevre.service.Event({
            endpoint: process.env.CHEVRE_ENDPOINT,
            auth: chevreAuthClient
        });
        const ticketTypes = yield eventService.searchScreeningEventTicketTyps({ eventId: req.params.id });
        res.json(ticketTypes);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * 上映イベントに対するオファー検索
 */
eventsRouter.get('/screeningEvent/:id/offers', permitScopes_1.default(['aws.cognito.signin.user.admin', 'events', 'events.read-only']), validator_1.default, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const eventService = new cinerino.chevre.service.Event({
            endpoint: process.env.CHEVRE_ENDPOINT,
            auth: chevreAuthClient
        });
        const offers = yield eventService.searchScreeningEventOffers({ eventId: req.params.id });
        res.json(offers);
    }
    catch (error) {
        next(error);
    }
}));
exports.default = eventsRouter;
