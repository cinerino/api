/**
 * 上映イベントルーター
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';
// tslint:disable-next-line:no-submodule-imports
import { query } from 'express-validator/check';

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

/**
 * イベント検索
 */
screeningEventRouter.get(
    '',
    permitScopes(['aws.cognito.signin.user.admin', 'events', 'events.read-only']),
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
            const eventRepo = new cinerino.repository.Event(cinerino.mongoose.connection);
            const searchCoinditions: cinerino.chevre.factory.event.screeningEvent.ISearchConditions = {
                ...req.query,
                // tslint:disable-next-line:no-magic-numbers
                limit: (req.query.limit !== undefined) ? Math.min(req.query.limit, 100) : 100,
                page: (req.query.page !== undefined) ? Math.max(req.query.page, 1) : 1
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

/**
 * IDでイベント検索
 */
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
    }
);

/**
 * イベントに対するオファー検索
 */
screeningEventRouter.get(
    '/:id/offers',
    permitScopes(['aws.cognito.signin.user.admin', 'events', 'events.read-only']),
    validator,
    async (req, res, next) => {
        try {
            const eventRepo = new cinerino.repository.Event(cinerino.mongoose.connection);
            const eventService = new cinerino.chevre.service.Event({
                endpoint: <string>process.env.CHEVRE_ENDPOINT,
                auth: chevreAuthClient
            });
            const offers = await cinerino.service.offer.searchScreeningEventOffers({
                event: { id: req.params.id }
            })({
                event: eventRepo,
                eventService: eventService
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
screeningEventRouter.get(
    '/:id/offers/ticket',
    permitScopes(['aws.cognito.signin.user.admin', 'events', 'events.read-only']),
    ...[
        query('seller')
            .not()
            .isEmpty()
            .withMessage((_, options) => `${options.path} is required`),
        query('store')
            .not()
            .isEmpty()
            .withMessage((_, options) => `${options.path} is required`)
    ],
    validator,
    async (req, res, next) => {
        try {
            const eventRepo = new cinerino.repository.Event(cinerino.mongoose.connection);
            const organizationRepo = new cinerino.repository.Organization(cinerino.mongoose.connection);
            const eventService = new cinerino.chevre.service.Event({
                endpoint: <string>process.env.CHEVRE_ENDPOINT,
                auth: chevreAuthClient
            });
            const offers = await cinerino.service.offer.searchScreeningEventTicketOffers({
                event: { id: req.params.id },
                seller: req.query.seller,
                store: req.query.store
            })({
                event: eventRepo,
                eventService: eventService,
                organization: organizationRepo
            });
            res.json(offers);
        } catch (error) {
            next(error);
        }
    }
);
export default screeningEventRouter;
