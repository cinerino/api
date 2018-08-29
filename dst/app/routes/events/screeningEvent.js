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
 * 上映イベントルーター
 */
const cinerino = require("@cinerino/domain");
const express_1 = require("express");
const moment = require("moment");
// import * as redis from '../../redis';
const authentication_1 = require("../../middlewares/authentication");
const permitScopes_1 = require("../../middlewares/permitScopes");
const validator_1 = require("../../middlewares/validator");
const chevreAuthClient = new cinerino.chevre.auth.ClientCredentials({
    domain: process.env.CHEVRE_AUTHORIZE_SERVER_DOMAIN,
    clientId: process.env.CHEVRE_CLIENT_ID,
    clientSecret: process.env.CHEVRE_CLIENT_SECRET,
    scopes: [],
    state: ''
});
const screeningEventRouter = express_1.Router();
screeningEventRouter.use(authentication_1.default);
screeningEventRouter.get('', permitScopes_1.default(['aws.cognito.signin.user.admin', 'events', 'events.read-only']), (req, __, next) => {
    req.checkQuery('startFrom').optional().isISO8601().withMessage('startFrom must be ISO8601 timestamp');
    req.checkQuery('startThrough').optional().isISO8601().withMessage('startThrough must be ISO8601 timestamp');
    req.checkQuery('endFrom').optional().isISO8601().withMessage('endFrom must be ISO8601 timestamp');
    req.checkQuery('endThrough').optional().isISO8601().withMessage('endThrough must be ISO8601 timestamp');
    next();
}, validator_1.default, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const eventRepo = new cinerino.repository.Event(cinerino.mongoose.connection);
        const searchCoinditions = {
            // tslint:disable-next-line:no-magic-numbers
            limit: (req.query.limit !== undefined) ? Math.min(req.query.limit, 100) : /* istanbul ignore next*/ 100,
            page: (req.query.page !== undefined) ? Math.max(req.query.page, 1) : /* istanbul ignore next*/ 1,
            name: req.query.name,
            inSessionFrom: (req.query.inSessionFrom !== undefined) ? moment(req.query.inSessionFrom).toDate() : undefined,
            inSessionThrough: (req.query.inSessionThrough !== undefined) ? moment(req.query.inSessionThrough).toDate() : undefined,
            startFrom: (req.query.startFrom !== undefined) ? moment(req.query.startFrom).toDate() : undefined,
            startThrough: (req.query.startThrough !== undefined) ? moment(req.query.startThrough).toDate() : undefined,
            endFrom: (req.query.endFrom !== undefined) ? moment(req.query.endFrom).toDate() : undefined,
            endThrough: (req.query.endThrough !== undefined) ? moment(req.query.endThrough).toDate() : undefined,
            eventStatuses: (Array.isArray(req.query.eventStatuses)) ? req.query.eventStatuses : undefined,
            superEvent: req.query.superEvent
        };
        const events = yield eventRepo.searchScreeningEvents(searchCoinditions);
        const totalCount = yield eventRepo.countScreeningEvents(searchCoinditions);
        res.set('Total-Count', totalCount.toString());
        res.json(events);
    }
    catch (error) {
        next(error);
    }
}));
screeningEventRouter.get('/:id', permitScopes_1.default(['aws.cognito.signin.user.admin', 'events', 'events.read-only']), validator_1.default, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const eventRepo = new cinerino.repository.Event(cinerino.mongoose.connection);
        const event = yield eventRepo.findById({ typeOf: cinerino.factory.chevre.eventType.ScreeningEvent, id: req.params.id });
        res.json(event);
    }
    catch (error) {
        next(error);
    }
}));
screeningEventRouter.get('/:id/ticketTypes', permitScopes_1.default(['aws.cognito.signin.user.admin', 'events', 'events.read-only']), validator_1.default, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const eventService = new cinerino.chevre.service.Event({
            endpoint: process.env.CHEVRE_ENDPOINT,
            auth: chevreAuthClient
        });
        const ticketTypes = yield eventService.searchScreeningEventTicketTypes({ eventId: req.params.id });
        res.json(ticketTypes);
    }
    catch (error) {
        next(error);
    }
}));
screeningEventRouter.get('/:id/offers', permitScopes_1.default(['aws.cognito.signin.user.admin', 'events', 'events.read-only']), validator_1.default, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
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
exports.default = screeningEventRouter;
