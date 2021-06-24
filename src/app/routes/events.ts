/**
 * イベントルーター
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';
// tslint:disable-next-line:no-implicit-dependencies
import { ParamsDictionary } from 'express-serve-static-core';
import { query } from 'express-validator';
// import { NO_CONTENT } from 'http-status';
// import * as mongoose from 'mongoose';

import permitScopes from '../middlewares/permitScopes';
import rateLimit from '../middlewares/rateLimit';
import validator from '../middlewares/validator';

// const chevreAuthClient = new cinerino.chevre.auth.ClientCredentials({
//     domain: <string>process.env.CHEVRE_AUTHORIZE_SERVER_DOMAIN,
//     clientId: <string>process.env.CHEVRE_CLIENT_ID,
//     clientSecret: <string>process.env.CHEVRE_CLIENT_SECRET,
//     scopes: [],
//     state: ''
// });

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
            req.query.typeOf = cinerino.factory.eventType.ScreeningEvent;
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
            const eventService = new cinerino.chevre.service.Event({
                endpoint: cinerino.credentials.chevre.endpoint,
                auth: req.chevreAuthClient,
                project: { id: req.project.id }
            });

            const searchConditions: cinerino.factory.event.screeningEvent.ISearchConditions = {
                ...req.query,
                project: { id: { $eq: req.project.id } },
                // tslint:disable-next-line:no-magic-numbers
                limit: (req.query.limit !== undefined) ? Math.min(req.query.limit, 100) : undefined,
                page: (req.query.page !== undefined) ? Math.max(req.query.page, 1) : undefined
            };

            const searchEventsResult = await eventService.search(searchConditions);

            res.json(searchEventsResult.data);
        } catch (error) {
            next(cinerino.errorHandler.handleChevreError(error));
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
            let event: cinerino.factory.event.screeningEvent.IEvent;

            const eventService = new cinerino.chevre.service.Event({
                endpoint: cinerino.credentials.chevre.endpoint,
                auth: req.chevreAuthClient,
                project: { id: req.project.id }
            });
            event = await eventService.findById({ id: req.params.id });

            res.json(event);
        } catch (error) {
            next(cinerino.errorHandler.handleChevreError(error));
        }
    }
);

/**
 * イベント部分更新
 */
// tslint:disable-next-line:use-default-type-parameter
// eventsRouter.patch<ParamsDictionary>(
//     '/:id',
//     permitScopes(['events.*', 'events.update']),
//     rateLimit,
//     ...[
//         body('onUpdated.sendEmailMessage')
//             .optional()
//             .isArray({ max: 50 })
//     ],
//     validator,
//     async (req, res, next) => {
//         try {
//             const eventService = new cinerino.chevre.service.Event({
//                 endpoint: cinerino.credentials.chevre.endpoint,
//                 auth: chevreAuthClient,
//                 project: { id: req.project.id }
//             });

//             const event = await eventService.findById<cinerino.factory.eventType.ScreeningEvent>({ id: req.params.id });

//             await eventService.updatePartially<cinerino.factory.eventType.ScreeningEvent>({
//                 id: event.id,
//                 attributes: <any>{
//                     // ...event,
//                     typeOf: event.typeOf,
//                     // とりあえず限定された属性のみ更新を許可
//                     ...(typeof req.body.eventStatus === 'string') ? { eventStatus: req.body.eventStatus } : undefined
//                 }
//             });

//             // onUpdatedオプションを実装
//             const sendEmailMessage: cinerino.factory.action.transfer.send.message.email.IAttributes[]
//                 = req.body.onUpdated?.sendEmailMessage;
//             if (Array.isArray(sendEmailMessage) && sendEmailMessage.length > 0) {
//                 const taskRepo = new cinerino.repository.Task(mongoose.connection);
//                 const runsAt = new Date();
//                 const taskAttributes: cinerino.factory.task.IAttributes<cinerino.factory.taskName.SendEmailMessage>[]
//                     = sendEmailMessage.map((s) => {
//                         return {
//                             project: { typeOf: req.project.typeOf, id: req.project.id },
//                             name: cinerino.factory.taskName.SendEmailMessage,
//                             status: cinerino.factory.taskStatus.Ready,
//                             runsAt: runsAt,
//                             remainingNumberOfTries: 3,
//                             numberOfTried: 0,
//                             executionResults: [],
//                             data: {
//                                 actionAttributes: {
//                                     ...s,
//                                     agent: req.agent,
//                                     typeOf: cinerino.factory.actionType.SendAction
//                                 }
//                             }
//                         };
//                     });

//                 await taskRepo.saveMany(taskAttributes);
//             }

//             res.status(NO_CONTENT)
//                 .end();
//         } catch (error) {
//             error = cinerino.errorHandler.handleChevreError(error);
//             next(error);
//         }
//     }
// );

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
            const eventService = new cinerino.chevre.service.Event({
                endpoint: cinerino.credentials.chevre.endpoint,
                auth: req.chevreAuthClient,
                project: { id: req.project.id }
            });

            const offers = await cinerino.service.offer.searchEventTicketOffers({
                project: req.project,
                event: { id: req.params.id },
                seller: req.query.seller,
                store: req.query.store,
                ...(req.query.movieTicket !== undefined && req.query.movieTicket !== null)
                    ? { movieTicket: req.query.movieTicket }
                    : {}
            })({
                event: eventService
            });
            res.json(offers);
        } catch (error) {
            next(cinerino.errorHandler.handleChevreError(error));
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
            const eventService = new cinerino.chevre.service.Event({
                endpoint: cinerino.credentials.chevre.endpoint,
                auth: req.chevreAuthClient,
                project: { id: req.project.id }
            });

            const seats = await eventService.searchSeats({
                ...req.query,
                id: req.params.id,
                // 試しに冗長な情報を非取得にしてみる
                $projection: {
                    'containedInPlace.containedInPlace': 0
                }
            });

            res.json(seats.data);
        } catch (error) {
            next(cinerino.errorHandler.handleChevreError(error));
        }
    }
);

export default eventsRouter;
