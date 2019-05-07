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
// tslint:disable-next-line:no-submodule-imports
const check_1 = require("express-validator/check");
const mongoose = require("mongoose");
const screeningEvent_1 = require("./events/screeningEvent");
const redis = require("../../redis");
const authentication_1 = require("../middlewares/authentication");
const permitScopes_1 = require("../middlewares/permitScopes");
const validator_1 = require("../middlewares/validator");
const eventsRouter = express_1.Router();
eventsRouter.use(authentication_1.default);
eventsRouter.use('/screeningEvent', screeningEvent_1.default);
/**
 * Cinemasunshine対応
 * @deprecated Use /screeningEvent/:id
 */
eventsRouter.get('/individualScreeningEvent/:id', permitScopes_1.default(['customer', 'events', 'events.read-only']), validator_1.default, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        yield cinerino.service.offer.findEventById4cinemasunshine(req.params.id)({
            attendeeCapacity: new cinerino.repository.event.AttendeeCapacityRepo(redis.getClient()),
            event: new cinerino.repository.Event(mongoose.connection)
            // itemAvailability: new cinerino.repository.itemAvailability.ScreeningEvent(redis.getClient())
        })
            .then((event) => {
            res.json(event);
        });
    }
    catch (error) {
        next(error);
    }
}));
/**
 * Cinemasunshine対応
 * @deprecated Use /screeningEvent
 */
eventsRouter.get('/individualScreeningEvent', permitScopes_1.default(['customer', 'events', 'events.read-only']), ...[
    check_1.query('startFrom')
        .optional()
        .isISO8601()
        .toDate(),
    check_1.query('startThrough')
        .optional()
        .isISO8601()
        .toDate(),
    check_1.query('endFrom')
        .optional()
        .isISO8601()
        .toDate(),
    check_1.query('endThrough')
        .optional()
        .isISO8601()
        .toDate()
], validator_1.default, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const eventRepo = new cinerino.repository.Event(mongoose.connection);
        const attendeeCapacityRepo = new cinerino.repository.event.AttendeeCapacityRepo(redis.getClient());
        // const itemAvailabilityRepo = new cinerino.repository.itemAvailability.ScreeningEvent(redis.getClient());
        const searchConditions = Object.assign({}, req.query, { 
            // tslint:disable-next-line:no-magic-numbers
            limit: (req.query.limit !== undefined) ? Math.min(req.query.limit, 100) : undefined, page: (req.query.page !== undefined) ? Math.max(req.query.page, 1) : undefined, sort: (req.query.sort !== undefined) ? req.query.sort : { startDate: cinerino.factory.sortType.Ascending } });
        const events = yield cinerino.service.offer.searchEvents4cinemasunshine(searchConditions)({
            attendeeCapacity: attendeeCapacityRepo,
            event: eventRepo
            // itemAvailability: itemAvailabilityRepo
        });
        const totalCount = yield eventRepo.countScreeningEvents(searchConditions);
        res.set('X-Total-Count', totalCount.toString());
        res.json(events);
    }
    catch (error) {
        next(error);
    }
}));
exports.default = eventsRouter;
