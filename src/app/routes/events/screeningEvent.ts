/**
 * 上映イベントルーター
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';
// tslint:disable-next-line:no-implicit-dependencies
import { ParamsDictionary } from 'express-serve-static-core';
// tslint:disable-next-line:no-submodule-imports
import { query } from 'express-validator/check';
import * as mongoose from 'mongoose';

import * as redis from '../../../redis';

import permitScopes from '../../middlewares/permitScopes';
import validator from '../../middlewares/validator';

const MULTI_TENANT_SUPPORTED = process.env.MULTI_TENANT_SUPPORTED === '1';

const screeningEventRouter = Router();

/**
 * イベント検索
 */
screeningEventRouter.get(
    '',
    permitScopes(['customer', 'events', 'events.read-only']),
    ...[
        query('inSessionFrom')
            .optional()
            .isISO8601()
            .toDate(),
        query('inSessionThrough')
            .optional()
            .isISO8601()
            .toDate(),
        query('startFrom')
            .optional()
            .isISO8601()
            .toDate(),
        query('startThrough')
            .optional()
            .isISO8601()
            .toDate(),
        query('endFrom')
            .optional()
            .isISO8601()
            .toDate(),
        query('endThrough')
            .optional()
            .isISO8601()
            .toDate(),
        query('offers.availableFrom')
            .optional()
            .isISO8601()
            .toDate(),
        query('offers.availableThrough')
            .optional()
            .isISO8601()
            .toDate(),
        query('offers.validFrom')
            .optional()
            .isISO8601()
            .toDate(),
        query('offers.validThrough')
            .optional()
            .isISO8601()
            .toDate()
    ],
    validator,
    async (req, res, next) => {
        try {
            const attendeeCapacityRepo = new cinerino.repository.event.AttendeeCapacityRepo(redis.getClient());
            const eventRepo = new cinerino.repository.Event(mongoose.connection);
            const projectRepo = new cinerino.repository.Project(mongoose.connection);

            let events: cinerino.factory.chevre.event.screeningEvent.IEvent[];
            let totalCount: number;

            // Cinemasunshine対応
            if (process.env.USE_REDIS_EVENT_ITEM_AVAILABILITY_REPO === '1') {
                // const itemAvailabilityRepo = new cinerino.repository.itemAvailability.ScreeningEvent(redis.getClient());

                const searchConditions: cinerino.chevre.factory.event.screeningEvent.ISearchConditions = {
                    ...req.query,
                    // tslint:disable-next-line:no-magic-numbers
                    limit: (req.query.limit !== undefined) ? Math.min(req.query.limit, 100) : undefined,
                    page: (req.query.page !== undefined) ? Math.max(req.query.page, 1) : undefined,
                    typeOf: cinerino.factory.chevre.eventType.ScreeningEvent
                };

                events = await cinerino.service.offer.searchEvents4cinemasunshine(searchConditions)({
                    attendeeCapacity: attendeeCapacityRepo,
                    event: eventRepo
                    // itemAvailability: itemAvailabilityRepo
                });
                totalCount = await eventRepo.count(searchConditions);
            } else {
                const searchConditions: cinerino.chevre.factory.event.screeningEvent.ISearchConditions = {
                    ...req.query,
                    project: (MULTI_TENANT_SUPPORTED) ? { ids: [req.project.id] } : undefined,
                    // tslint:disable-next-line:no-magic-numbers
                    limit: (req.query.limit !== undefined) ? Math.min(req.query.limit, 100) : 100,
                    page: (req.query.page !== undefined) ? Math.max(req.query.page, 1) : 1,
                    typeOf: cinerino.factory.chevre.eventType.ScreeningEvent
                };

                const searchEventsResult = await cinerino.service.offer.searchEvents({
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
        } catch (error) {
            next(error);
        }
    }
);

/**
 * IDでイベント検索
 */
screeningEventRouter.get(
    '/:id',
    permitScopes(['customer', 'events', 'events.read-only']),
    validator,
    async (req, res, next) => {
        try {
            const attendeeCapacityRepo = new cinerino.repository.event.AttendeeCapacityRepo(redis.getClient());
            const eventRepo = new cinerino.repository.Event(mongoose.connection);

            let event: cinerino.factory.chevre.event.screeningEvent.IEvent;

            // Cinemasunshine対応
            if (process.env.USE_REDIS_EVENT_ITEM_AVAILABILITY_REPO === '1') {
                event = await cinerino.service.offer.findEventById4cinemasunshine(req.params.id)({
                    attendeeCapacity: attendeeCapacityRepo,
                    event: new cinerino.repository.Event(mongoose.connection)
                    // itemAvailability: new cinerino.repository.itemAvailability.ScreeningEvent(redis.getClient())
                });
            } else {
                event = await eventRepo.findById({ id: req.params.id });
            }

            res.json(event);
        } catch (error) {
            next(error);
        }
    }
);

/**
 * イベントに対するオファー検索
 */
screeningEventRouter.get(
    '/:id/offers',
    permitScopes(['customer', 'events', 'events.read-only']),
    validator,
    async (req, res, next) => {
        try {
            const eventRepo = new cinerino.repository.Event(mongoose.connection);
            const projectRepo = new cinerino.repository.Project(mongoose.connection);

            const offers = await cinerino.service.offer.searchEventOffers({
                project: req.project,
                event: { id: req.params.id }
            })({
                event: eventRepo,
                project: projectRepo
            });

            res.json(offers);
        } catch (error) {
            next(error);
        }
    }
);

/**
 * イベントに対する券種オファー検索
 */
// tslint:disable-next-line:use-default-type-parameter
screeningEventRouter.get<ParamsDictionary>(
    '/:id/offers/ticket',
    permitScopes(['customer', 'events', 'events.read-only']),
    ...[
        query('seller')
            .not()
            .isEmpty()
            .withMessage((_, __) => 'required'),
        query('store')
            .not()
            .isEmpty()
            .withMessage((_, __) => 'required')
    ],
    validator,
    async (req, res, next) => {
        try {
            const eventRepo = new cinerino.repository.Event(mongoose.connection);
            const projectRepo = new cinerino.repository.Project(mongoose.connection);
            const sellerRepo = new cinerino.repository.Seller(mongoose.connection);

            const offers = await cinerino.service.offer.searchEventTicketOffers({
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
        } catch (error) {
            next(error);
        }
    }
);
export default screeningEventRouter;
