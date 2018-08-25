/**
 * イベントルーター
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';
import * as moment from 'moment';

// import * as redis from '../../redis';
import authentication from '../middlewares/authentication';
import permitScopes from '../middlewares/permitScopes';
import validator from '../middlewares/validator';

const chevreAuthClient = new cinerino.chevre.auth.ClientCredentials({
    domain: <string>process.env.CHEVRE_AUTHORIZE_SERVER_DOMAIN,
    clientId: <string>process.env.CHEVRE_CLIENT_ID,
    clientSecret: <string>process.env.CHEVRE_CLIENT_SECRET,
    scopes: [],
    state: ''
});

const eventsRouter = Router();
eventsRouter.use(authentication);

eventsRouter.get(
    '/screeningEvent',
    permitScopes(['aws.cognito.signin.user.admin', 'events', 'events.read-only']),
    (req, __, next) => {
        req.checkQuery('startFrom').optional().isISO8601().withMessage('startFrom must be ISO8601 timestamp');
        req.checkQuery('startThrough').optional().isISO8601().withMessage('startThrough must be ISO8601 timestamp');
        req.checkQuery('endFrom').optional().isISO8601().withMessage('endFrom must be ISO8601 timestamp');
        req.checkQuery('endThrough').optional().isISO8601().withMessage('endThrough must be ISO8601 timestamp');

        next();
    },
    validator,
    async (req, res, next) => {
        try {
            const events = await cinerino.service.event.searchScreeningEvents({
                name: req.query.name,
                startFrom: (req.query.startFrom !== undefined) ? moment(req.query.startFrom).toDate() : undefined,
                startThrough: (req.query.startThrough !== undefined) ? moment(req.query.startThrough).toDate() : undefined,
                endFrom: (req.query.endFrom !== undefined) ? moment(req.query.endFrom).toDate() : undefined,
                endThrough: (req.query.endThrough !== undefined) ? moment(req.query.endThrough).toDate() : undefined,
                eventStatuses: (Array.isArray(req.query.eventStatuses)) ? req.query.eventStatuses : undefined,
                superEventLocationIds:
                    (Array.isArray(req.query.superEventLocationIds)) ? req.query.superEventLocationIds : undefined,
                workPerformedIds:
                    (Array.isArray(req.query.workPerformedIds)) ? req.query.workPerformedIds : undefined
            })({
                event: new cinerino.repository.Event(cinerino.mongoose.connection)
                // itemAvailability: new cinerino.repository.itemAvailability.IndividualScreeningEvent(redis.getClient())
            });
            res.json(events);
        } catch (error) {
            next(error);
        }
    }
);

eventsRouter.get(
    '/screeningEvent/:id',
    permitScopes(['aws.cognito.signin.user.admin', 'events', 'events.read-only']),
    validator,
    async (req, res, next) => {
        try {
            const event = await cinerino.service.event.findScreeningEventById(req.params.id)({
                event: new cinerino.repository.Event(cinerino.mongoose.connection)
                // itemAvailability: new cinerino.repository.itemAvailability.IndividualScreeningEvent(redis.getClient())
            });
            res.json(event);
        } catch (error) {
            next(error);
        }
    });

/**
 * 上映イベントに対する券種検索
 */
eventsRouter.get(
    '/screeningEvent/:id/ticketTypes',
    permitScopes(['aws.cognito.signin.user.admin', 'events', 'events.read-only']),
    validator,
    async (req, res, next) => {
        try {
            const eventService = new cinerino.chevre.service.Event({
                endpoint: <string>process.env.CHEVRE_ENDPOINT,
                auth: chevreAuthClient
            });
            const ticketTypes = await eventService.searchScreeningEventTicketTypes({ eventId: req.params.id });
            res.json(ticketTypes);
        } catch (error) {
            next(error);
        }
    });

/**
 * 上映イベントに対するオファー検索
 */
eventsRouter.get(
    '/screeningEvent/:id/offers',
    permitScopes(['aws.cognito.signin.user.admin', 'events', 'events.read-only']),
    validator,
    async (req, res, next) => {
        try {
            const eventService = new cinerino.chevre.service.Event({
                endpoint: <string>process.env.CHEVRE_ENDPOINT,
                auth: chevreAuthClient
            });
            const offers = await eventService.searchScreeningEventOffers({ eventId: req.params.id });
            res.json(offers);
        } catch (error) {
            next(error);
        }
    });

export default eventsRouter;
