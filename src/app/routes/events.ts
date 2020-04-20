/**
 * イベントルーター
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';
// tslint:disable-next-line:no-implicit-dependencies
import { ParamsDictionary } from 'express-serve-static-core';
import { query } from 'express-validator';
import * as mongoose from 'mongoose';

import permitScopes from '../middlewares/permitScopes';
import rateLimit from '../middlewares/rateLimit';
import validator from '../middlewares/validator';

const chevreAuthClient = new cinerino.chevre.auth.ClientCredentials({
    domain: <string>process.env.CHEVRE_AUTHORIZE_SERVER_DOMAIN,
    clientId: <string>process.env.CHEVRE_CLIENT_ID,
    clientSecret: <string>process.env.CHEVRE_CLIENT_SECRET,
    scopes: [],
    state: ''
});

const eventsRouter = Router();

/**
 * イベント検索
 */
eventsRouter.get(
    '',
    permitScopes(['events.*', 'events.read']),
    rateLimit,
    // 互換性維持のため
    (req, _, next) => {
        if (typeof req.query.typeOf !== 'string') {
            req.query.typeOf = cinerino.factory.chevre.eventType.ScreeningEvent;
        }

        next();
    },
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
            const projectRepo = new cinerino.repository.Project(mongoose.connection);

            const project = await projectRepo.findById({ id: req.project.id });
            const useRedisEventItemAvailabilityRepo = project.settings?.useRedisEventItemAvailabilityRepo === true;

            let searchEventsResult: {
                data: cinerino.factory.chevre.event.screeningEvent.IEvent[];
                totalCount: number;
            };

            const searchConditions: cinerino.chevre.factory.event.screeningEvent.ISearchConditions = {
                ...req.query,
                project: { ids: [req.project.id] },
                // tslint:disable-next-line:no-magic-numbers
                limit: (req.query.limit !== undefined) ? Math.min(req.query.limit, 100) : undefined,
                page: (req.query.page !== undefined) ? Math.max(req.query.page, 1) : undefined
            };

            // Cinemasunshine対応
            if (useRedisEventItemAvailabilityRepo) {
                searchEventsResult = await cinerino.service.offer.searchEvents4cinemasunshine({
                    project: req.project,
                    conditions: searchConditions
                })({
                    project: projectRepo
                });
            } else {
                searchEventsResult = await cinerino.service.offer.searchEvents({
                    project: req.project,
                    conditions: searchConditions
                })({
                    project: projectRepo
                });
            }

            res.set('X-Total-Count', searchEventsResult.totalCount.toString())
                .json(searchEventsResult.data);
        } catch (error) {
            next(error);
        }
    }
);

/**
 * IDでイベント検索
 */
eventsRouter.get(
    '/:id',
    permitScopes(['events.*', 'events.read']),
    rateLimit,
    validator,
    async (req, res, next) => {
        try {
            const eventRepo = new cinerino.repository.Event(mongoose.connection);
            const projectRepo = new cinerino.repository.Project(mongoose.connection);

            let event: cinerino.factory.chevre.event.screeningEvent.IEvent;

            const project = await projectRepo.findById({ id: req.project.id });
            const useEventRepo = project.settings?.useEventRepo === true;
            const useRedisEventItemAvailabilityRepo = project.settings?.useRedisEventItemAvailabilityRepo === true;

            // Cinemasunshine対応
            if (useRedisEventItemAvailabilityRepo) {
                event = await cinerino.service.offer.findEventById4cinemasunshine({
                    id: req.params.id,
                    project: req.project
                })({
                    project: projectRepo
                });
            } else {
                if (useEventRepo) {
                    event = await eventRepo.findById({ id: req.params.id });
                } else {
                    if (project.settings?.chevre === undefined) {
                        throw new cinerino.factory.errors.ServiceUnavailable('Project settings not satisfied');
                    }

                    const eventService = new cinerino.chevre.service.Event({
                        endpoint: project.settings.chevre.endpoint,
                        auth: chevreAuthClient
                    });
                    event = await eventService.findById({ id: req.params.id });
                }
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
eventsRouter.get(
    '/:id/offers',
    permitScopes(['events.*', 'events.read']),
    rateLimit,
    validator,
    async (req, res, next) => {
        try {
            const projectRepo = new cinerino.repository.Project(mongoose.connection);

            const offers = await cinerino.service.offer.searchEventOffers({
                project: req.project,
                event: { id: req.params.id }
            })({
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
eventsRouter.get<ParamsDictionary>(
    '/:id/offers/ticket',
    permitScopes(['events.*', 'events.read']),
    rateLimit,
    ...[
        query('seller')
            .not()
            .isEmpty()
            .withMessage(() => 'required'),
        query('store')
            .not()
            .isEmpty()
            .withMessage(() => 'required')
    ],
    validator,
    async (req, res, next) => {
        try {
            const projectRepo = new cinerino.repository.Project(mongoose.connection);
            const sellerRepo = new cinerino.repository.Seller(mongoose.connection);

            const offers = await cinerino.service.offer.searchEventTicketOffers({
                project: req.project,
                event: { id: req.params.id },
                seller: req.query.seller,
                store: req.query.store,
                ...(req.query.movieTicket !== undefined && req.query.movieTicket !== null)
                    ? { movieTicket: req.query.movieTicket }
                    : {}
            })({
                project: projectRepo,
                seller: sellerRepo
            });
            res.json(offers);
        } catch (error) {
            next(error);
        }
    }
);

/**
 * イベントに対する座席検索
 */
eventsRouter.get(
    '/:id/seats',
    permitScopes(['events.*', 'events.read']),
    rateLimit,
    validator,
    async (req, res, next) => {
        try {
            const projectRepo = new cinerino.repository.Project(mongoose.connection);

            const project = await projectRepo.findById({ id: req.project.id });
            if (project.settings?.chevre === undefined) {
                throw new cinerino.factory.errors.ServiceUnavailable('Project settings not satisfied');
            }

            const eventService = new cinerino.chevre.service.Event({
                endpoint: project.settings.chevre.endpoint,
                auth: chevreAuthClient
            });

            const seats = await eventService.searchSeats({
                ...req.query,
                id: req.params.id
            });

            res.json(seats.data);
        } catch (error) {
            next(error);
        }
    }
);

export default eventsRouter;
