/**
 * イベントルーター
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';
// tslint:disable-next-line:no-submodule-imports
import { query } from 'express-validator/check';
import * as mongoose from 'mongoose';

import screeningEventRouter from './events/screeningEvent';

import * as redis from '../../redis';

import authentication from '../middlewares/authentication';
import permitScopes from '../middlewares/permitScopes';
import validator from '../middlewares/validator';

const eventsRouter = Router();
eventsRouter.use(authentication);

eventsRouter.use('/screeningEvent', screeningEventRouter);

/**
 * Cinemasunshine対応
 * @deprecated Use /screeningEvent/:id
 */
eventsRouter.get(
    '/individualScreeningEvent/:id',
    permitScopes(['customer', 'events', 'events.read-only']),
    validator,
    async (req, res, next) => {
        try {
            await cinerino.service.offer.findEventById4cinemasunshine(<string>req.params.id)({
                attendeeCapacity: new cinerino.repository.event.AttendeeCapacityRepo(redis.getClient()),
                event: new cinerino.repository.Event(mongoose.connection)
                // itemAvailability: new cinerino.repository.itemAvailability.ScreeningEvent(redis.getClient())
            })
                .then((event) => {
                    res.json(event);
                });
        } catch (error) {
            next(error);
        }
    });

/**
 * Cinemasunshine対応
 * @deprecated Use /screeningEvent
 */
eventsRouter.get(
    '/individualScreeningEvent',
    permitScopes(['customer', 'events', 'events.read-only']),
    ...[
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
            .toDate()
    ],
    validator,
    async (req, res, next) => {
        try {
            const eventRepo = new cinerino.repository.Event(mongoose.connection);
            const attendeeCapacityRepo = new cinerino.repository.event.AttendeeCapacityRepo(redis.getClient());
            // const itemAvailabilityRepo = new cinerino.repository.itemAvailability.ScreeningEvent(redis.getClient());

            const searchConditions: cinerino.factory.event.screeningEvent.ISearchConditions = {
                ...req.query,
                // tslint:disable-next-line:no-magic-numbers
                limit: (req.query.limit !== undefined) ? Math.min(req.query.limit, 100) : undefined,
                page: (req.query.page !== undefined) ? Math.max(req.query.page, 1) : undefined,
                sort: (req.query.sort !== undefined) ? req.query.sort : { startDate: cinerino.factory.sortType.Ascending }
            };
            const events = await cinerino.service.offer.searchEvents4cinemasunshine(searchConditions)({
                attendeeCapacity: attendeeCapacityRepo,
                event: eventRepo
                // itemAvailability: itemAvailabilityRepo
            });
            const totalCount = await eventRepo.countScreeningEvents(searchConditions);

            res.set('X-Total-Count', totalCount.toString());
            res.json(events);
        } catch (error) {
            next(error);
        }
    }
);

export default eventsRouter;
