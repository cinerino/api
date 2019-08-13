/**
 * ムビチケ決済ルーター
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';
// tslint:disable-next-line:no-submodule-imports
import { body } from 'express-validator/check';
import { CREATED, NO_CONTENT } from 'http-status';
import * as mongoose from 'mongoose';

import authentication from '../../middlewares/authentication';
import lockTransaction from '../../middlewares/lockTransaction';
import permitScopes from '../../middlewares/permitScopes';
import rateLimit4transactionInProgress from '../../middlewares/rateLimit4transactionInProgress';
import validator from '../../middlewares/validator';

const mvtkReserveAuthClient = new cinerino.mvtkreserveapi.auth.ClientCredentials({
    domain: <string>process.env.MVTK_RESERVE_AUTHORIZE_SERVER_DOMAIN,
    clientId: <string>process.env.MVTK_RESERVE_CLIENT_ID,
    clientSecret: <string>process.env.MVTK_RESERVE_CLIENT_SECRET,
    scopes: [],
    state: ''
});

const movieTicketPaymentRouter = Router();
movieTicketPaymentRouter.use(authentication);

/**
 * ムビチケ購入番号確認
 */
movieTicketPaymentRouter.post(
    '/actions/check',
    permitScopes(['customer', 'tokens']),
    validator,
    async (req, res, next) => {
        try {
            const projectRepo = new cinerino.repository.Project(mongoose.connection);
            const project = await projectRepo.findById({ id: req.project.id });
            if (project.settings === undefined) {
                throw new cinerino.factory.errors.ServiceUnavailable('Project settings undefined');
            }
            if (project.settings.mvtkReserve === undefined) {
                throw new cinerino.factory.errors.ServiceUnavailable('Project settings not found');
            }

            const action = await cinerino.service.payment.movieTicket.checkMovieTicket({
                project: req.project,
                typeOf: cinerino.factory.actionType.CheckAction,
                agent: req.agent,
                object: req.body
            })({
                action: new cinerino.repository.Action(mongoose.connection),
                event: new cinerino.repository.Event(mongoose.connection),
                seller: new cinerino.repository.Seller(mongoose.connection),
                movieTicket: new cinerino.repository.paymentMethod.MovieTicket({
                    endpoint: project.settings.mvtkReserve.endpoint,
                    auth: mvtkReserveAuthClient
                }),
                paymentMethod: new cinerino.repository.PaymentMethod(mongoose.connection)
            });
            res.status(CREATED)
                .json(action);
        } catch (error) {
            next(error);
        }
    }
);

/**
 * ムビチケ決済承認
 */
movieTicketPaymentRouter.post(
    '/authorize',
    permitScopes(['customer', 'transactions']),
    ...[
        body('object')
            .not()
            .isEmpty(),
        body('object.typeOf')
            .not()
            .isEmpty()
            .withMessage((_, __) => 'required'),
        body('object.amount')
            .not()
            .isEmpty()
            .withMessage((_, __) => 'required')
            .isInt(),
        body('object.additionalProperty')
            .optional()
            .isArray(),
        body('object.movieTickets')
            .not()
            .isEmpty()
            .withMessage((_, __) => 'required')
            .isArray()
    ],
    validator,
    async (req, res, next) => {
        await rateLimit4transactionInProgress({
            typeOf: req.body.purpose.typeOf,
            id: <string>req.body.purpose.id
        })(req, res, next);
    },
    async (req, res, next) => {
        await lockTransaction({
            typeOf: req.body.purpose.typeOf,
            id: <string>req.body.purpose.id
        })(req, res, next);
    },
    async (req, res, next) => {
        try {
            const projectRepo = new cinerino.repository.Project(mongoose.connection);
            const project = await projectRepo.findById({ id: req.project.id });
            if (project.settings === undefined) {
                throw new cinerino.factory.errors.ServiceUnavailable('Project settings undefined');
            }
            if (project.settings.mvtkReserve === undefined) {
                throw new cinerino.factory.errors.ServiceUnavailable('Project settings not found');
            }

            const action = await cinerino.service.payment.movieTicket.authorize({
                agent: { id: req.user.sub },
                object: {
                    typeOf: cinerino.factory.paymentMethodType.MovieTicket,
                    amount: 0,
                    additionalProperty: (Array.isArray(req.body.object.additionalProperty))
                        ? (<any[]>req.body.object.additionalProperty).map((p: any) => {
                            return { name: String(p.name), value: String(p.value) };
                        })
                        : [],
                    movieTickets: req.body.object.movieTickets,
                    ...(typeof req.body.object.name === 'string') ? { name: <string>req.body.object.name } : undefined
                },
                purpose: { typeOf: req.body.purpose.typeOf, id: <string>req.body.purpose.id }
            })({
                action: new cinerino.repository.Action(mongoose.connection),
                event: new cinerino.repository.Event(mongoose.connection),
                seller: new cinerino.repository.Seller(mongoose.connection),
                transaction: new cinerino.repository.Transaction(mongoose.connection),
                movieTicket: new cinerino.repository.paymentMethod.MovieTicket({
                    endpoint: project.settings.mvtkReserve.endpoint,
                    auth: mvtkReserveAuthClient
                })
            });
            res.status(CREATED)
                .json(action);
        } catch (error) {
            next(error);
        }
    }
);

/**
 * ムビチケ決済承認取消
 */
movieTicketPaymentRouter.put(
    '/authorize/:actionId/void',
    permitScopes(['customer', 'transactions']),
    validator,
    async (req, res, next) => {
        await rateLimit4transactionInProgress({
            typeOf: req.body.purpose.typeOf,
            id: <string>req.body.purpose.id
        })(req, res, next);
    },
    async (req, res, next) => {
        await lockTransaction({
            typeOf: req.body.purpose.typeOf,
            id: <string>req.body.purpose.id
        })(req, res, next);
    },
    async (req, res, next) => {
        try {
            await cinerino.service.payment.movieTicket.voidTransaction({
                agent: { id: req.user.sub },
                id: req.params.actionId,
                purpose: { typeOf: req.body.purpose.typeOf, id: <string>req.body.purpose.id }
            })({
                action: new cinerino.repository.Action(mongoose.connection),
                transaction: new cinerino.repository.Transaction(mongoose.connection)
            });

            res.status(NO_CONTENT)
                .end();
        } catch (error) {
            next(error);
        }
    }
);

export default movieTicketPaymentRouter;
