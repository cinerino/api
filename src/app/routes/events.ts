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
            const useRedisEventItemAvailabilityRepo = (<any>project).settings?.useRedisEventItemAvailabilityRepo === true;

            const searchConditions: cinerino.chevre.factory.event.screeningEvent.ISearchConditions = {
                ...req.query,
                project: { ids: [req.project.id] },
                // tslint:disable-next-line:no-magic-numbers
                limit: (req.query.limit !== undefined) ? Math.min(req.query.limit, 100) : undefined,
                page: (req.query.page !== undefined) ? Math.max(req.query.page, 1) : undefined
            };

            const searchEventsResult = await cinerino.service.offer.searchEvents({
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
            const projectRepo = new cinerino.repository.Project(mongoose.connection);

            let event: cinerino.factory.chevre.event.screeningEvent.IEvent;

            const project = await projectRepo.findById({ id: req.project.id });
            const useRedisEventItemAvailabilityRepo = (<any>project).settings?.useRedisEventItemAvailabilityRepo === true;

            if (project.settings?.chevre === undefined) {
                throw new cinerino.factory.errors.ServiceUnavailable('Project settings not satisfied');
            }

            const eventService = new cinerino.chevre.service.Event({
                endpoint: project.settings.chevre.endpoint,
                auth: chevreAuthClient
            });
            event = await eventService.findById({ id: req.params.id });

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
