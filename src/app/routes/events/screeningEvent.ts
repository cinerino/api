/**
 * 上映イベントルーター
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';
import * as moment from 'moment';

// import * as redis from '../../redis';
import authentication from '../../middlewares/authentication';
import permitScopes from '../../middlewares/permitScopes';
import validator from '../../middlewares/validator';

const chevreAuthClient = new cinerino.chevre.auth.ClientCredentials({
    domain: <string>process.env.CHEVRE_AUTHORIZE_SERVER_DOMAIN,
    clientId: <string>process.env.CHEVRE_CLIENT_ID,
    clientSecret: <string>process.env.CHEVRE_CLIENT_SECRET,
    scopes: [],
    state: ''
});
const screeningEventRouter = Router();
screeningEventRouter.use(authentication);
screeningEventRouter.get(
    '',
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
            const eventRepo = new cinerino.repository.Event(cinerino.mongoose.connection);
            const searchCoinditions: cinerino.chevre.factory.event.screeningEvent.ISearchConditions = {
                // tslint:disable-next-line:no-magic-numbers
                limit: (req.query.limit !== undefined) ? Math.min(req.query.limit, 100) : 100,
                page: (req.query.page !== undefined) ? Math.max(req.query.page, 1) : 1,
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
            const events = await eventRepo.searchScreeningEvents(searchCoinditions);
            const totalCount = await eventRepo.countScreeningEvents(searchCoinditions);
            res.set('X-Total-Count', totalCount.toString());
            res.json(events);
        } catch (error) {
            next(error);
        }
    }
);
screeningEventRouter.get(
    '/:id',
    permitScopes(['aws.cognito.signin.user.admin', 'events', 'events.read-only']),
    validator,
    async (req, res, next) => {
        try {
            const eventRepo = new cinerino.repository.Event(cinerino.mongoose.connection);
            const event = await eventRepo.findById({ typeOf: cinerino.factory.chevre.eventType.ScreeningEvent, id: req.params.id });
            res.json(event);
        } catch (error) {
            next(error);
        }
    });
screeningEventRouter.get(
    '/:id/ticketTypes',
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
screeningEventRouter.get(
    '/:id/offers',
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
export default screeningEventRouter;
