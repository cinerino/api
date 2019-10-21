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
 * 上映イベントルーター
 */
const cinerino = require("@cinerino/domain");
const express_1 = require("express");
// tslint:disable-next-line:no-submodule-imports
const check_1 = require("express-validator/check");
const mongoose = require("mongoose");
const redis = require("../../../redis");
const permitScopes_1 = require("../../middlewares/permitScopes");
const validator_1 = require("../../middlewares/validator");
const MULTI_TENANT_SUPPORTED = process.env.MULTI_TENANT_SUPPORTED === '1';
const screeningEventRouter = express_1.Router();
/**
 * イベント検索
 */
screeningEventRouter.get('', permitScopes_1.default(['customer', 'events', 'events.read-only']), ...[
    check_1.query('inSessionFrom')
        .optional()
        .isISO8601()
        .toDate(),
    check_1.query('inSessionThrough')
        .optional()
        .isISO8601()
        .toDate(),
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
        .toDate(),
    check_1.query('offers.availableFrom')
        .optional()
        .isISO8601()
        .toDate(),
    check_1.query('offers.availableThrough')
        .optional()
        .isISO8601()
        .toDate(),
    check_1.query('offers.validFrom')
        .optional()
        .isISO8601()
        .toDate(),
    check_1.query('offers.validThrough')
        .optional()
        .isISO8601()
        .toDate()
], validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const attendeeCapacityRepo = new cinerino.repository.event.AttendeeCapacityRepo(redis.getClient());
        const eventRepo = new cinerino.repository.Event(mongoose.connection);
        const projectRepo = new cinerino.repository.Project(mongoose.connection);
        let events;
        let totalCount;
        // Cinemasunshine対応
        if (process.env.USE_REDIS_EVENT_ITEM_AVAILABILITY_REPO === '1') {
            // const itemAvailabilityRepo = new cinerino.repository.itemAvailability.ScreeningEvent(redis.getClient());
            const searchConditions = Object.assign(Object.assign({}, req.query), { 
                // tslint:disable-next-line:no-magic-numbers
                limit: (req.query.limit !== undefined) ? Math.min(req.query.limit, 100) : undefined, page: (req.query.page !== undefined) ? Math.max(req.query.page, 1) : undefined, typeOf: cinerino.factory.chevre.eventType.ScreeningEvent });
            events = yield cinerino.service.offer.searchEvents4cinemasunshine(searchConditions)({
                attendeeCapacity: attendeeCapacityRepo,
                event: eventRepo
                // itemAvailability: itemAvailabilityRepo
            });
            totalCount = yield eventRepo.count(searchConditions);
        }
        else {
            const searchConditions = Object.assign(Object.assign({}, req.query), { project: (MULTI_TENANT_SUPPORTED) ? { ids: [req.project.id] } : undefined, 
                // tslint:disable-next-line:no-magic-numbers
                limit: (req.query.limit !== undefined) ? Math.min(req.query.limit, 100) : 100, page: (req.query.page !== undefined) ? Math.max(req.query.page, 1) : 1, typeOf: cinerino.factory.chevre.eventType.ScreeningEvent });
            const searchEventsResult = yield cinerino.service.offer.searchEvents({
                project: req.project,
                conditions: searchConditions
            })({
                event: eventRepo,
                attendeeCapacity: attendeeCapacityRepo,
                project: projectRepo
            });
            events = searchEventsResult.data;
            totalCount = searchEventsResult.totalCount;
        }
        res.set('X-Total-Count', totalCount.toString())
            .json(events);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * IDでイベント検索
 */
screeningEventRouter.get('/:id', permitScopes_1.default(['customer', 'events', 'events.read-only']), validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const attendeeCapacityRepo = new cinerino.repository.event.AttendeeCapacityRepo(redis.getClient());
        const eventRepo = new cinerino.repository.Event(mongoose.connection);
        let event;
        // Cinemasunshine対応
        if (process.env.USE_REDIS_EVENT_ITEM_AVAILABILITY_REPO === '1') {
            event = yield cinerino.service.offer.findEventById4cinemasunshine(req.params.id)({
                attendeeCapacity: attendeeCapacityRepo,
                event: new cinerino.repository.Event(mongoose.connection)
                // itemAvailability: new cinerino.repository.itemAvailability.ScreeningEvent(redis.getClient())
            });
        }
        else {
            event = yield eventRepo.findById({ id: req.params.id });
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
screeningEventRouter.get('/:id/offers', permitScopes_1.default(['customer', 'events', 'events.read-only']), validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const eventRepo = new cinerino.repository.Event(mongoose.connection);
        const projectRepo = new cinerino.repository.Project(mongoose.connection);
        const offers = yield cinerino.service.offer.searchEventOffers({
            project: req.project,
            event: { id: req.params.id }
        })({
            event: eventRepo,
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
screeningEventRouter.get('/:id/offers/ticket', permitScopes_1.default(['customer', 'events', 'events.read-only']), ...[
    check_1.query('seller')
        .not()
        .isEmpty()
        .withMessage((_, __) => 'required'),
    check_1.query('store')
        .not()
        .isEmpty()
        .withMessage((_, __) => 'required')
], validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const eventRepo = new cinerino.repository.Event(mongoose.connection);
        const projectRepo = new cinerino.repository.Project(mongoose.connection);
        const sellerRepo = new cinerino.repository.Seller(mongoose.connection);
        const offers = yield cinerino.service.offer.searchEventTicketOffers({
            project: req.project,
            event: { id: req.params.id },
            seller: req.query.seller,
            store: req.query.store
        })({
            event: eventRepo,
            project: projectRepo,
            seller: sellerRepo
        });
        res.json(offers);
    }
    catch (error) {
        next(error);
    }
}));
exports.default = screeningEventRouter;
