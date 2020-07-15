/**
 * ムビチケ決済ルーター
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';
// tslint:disable-next-line:no-implicit-dependencies
import { ParamsDictionary } from 'express-serve-static-core';
import { body } from 'express-validator';
import { CREATED, NO_CONTENT } from 'http-status';
import * as mongoose from 'mongoose';

import lockTransaction from '../../middlewares/lockTransaction';
import permitScopes from '../../middlewares/permitScopes';
import rateLimit from '../../middlewares/rateLimit';
import rateLimit4transactionInProgress from '../../middlewares/rateLimit4transactionInProgress';
import validator from '../../middlewares/validator';

const ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH = (process.env.ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH !== undefined)
    ? Number(process.env.ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH)
    // tslint:disable-next-line:no-magic-numbers
    : 256;

const chevreAuthClient = new cinerino.chevre.auth.ClientCredentials({
    domain: <string>process.env.CHEVRE_AUTHORIZE_SERVER_DOMAIN,
    clientId: <string>process.env.CHEVRE_CLIENT_ID,
    clientSecret: <string>process.env.CHEVRE_CLIENT_SECRET,
    scopes: [],
    state: ''
});

const mvtkReserveAuthClient = new cinerino.mvtkreserveapi.auth.ClientCredentials({
    domain: <string>process.env.MVTK_RESERVE_AUTHORIZE_SERVER_DOMAIN,
    clientId: <string>process.env.MVTK_RESERVE_CLIENT_ID,
    clientSecret: <string>process.env.MVTK_RESERVE_CLIENT_SECRET,
    scopes: [],
    state: ''
});

export async function getMvtKReserveEndpoint(params: {
    project: { id: string };
    paymentMethodType: string;
}): Promise<string> {
    // Chevreからサービスエンドポイントを取得する
    const projectService = new cinerino.chevre.service.Project({
        endpoint: cinerino.credentials.chevre.endpoint,
        auth: chevreAuthClient
    });
    const chevreProject = await projectService.findById({ id: params.project.id });
    const paymentServiceSetting = chevreProject.settings?.paymentServices?.find((s) => {
        return s.typeOf === cinerino.chevre.factory.service.paymentService.PaymentServiceType.MovieTicket
            && s.serviceOutput?.typeOf === params.paymentMethodType;
    });
    if (paymentServiceSetting === undefined) {
        throw new cinerino.factory.errors.NotFound('PaymentService');
    }
    const paymentServiceUrl = paymentServiceSetting.availableChannel?.serviceUrl;
    if (typeof paymentServiceUrl !== 'string') {
        throw new cinerino.factory.errors.NotFound('paymentService.availableChannel.serviceUrl');
    }

    return paymentServiceUrl;
}

const movieTicketPaymentRouter = Router();

/**
 * ムビチケ購入番号確認
 */
movieTicketPaymentRouter.post(
    '/actions/check',
    permitScopes(['transactions']),
    rateLimit,
    validator,
    async (req, res, next) => {
        try {
            let paymentMethodType: cinerino.factory.paymentMethodType.MovieTicket | cinerino.factory.paymentMethodType.MGTicket
                = req.body.typeOf;
            if (typeof paymentMethodType !== 'string') {
                paymentMethodType = cinerino.factory.paymentMethodType.MovieTicket;
            }

            const paymentServiceUrl = await getMvtKReserveEndpoint({
                project: { id: req.project.id },
                paymentMethodType: paymentMethodType
            });

            const action = await cinerino.service.payment.movieTicket.checkMovieTicket({
                project: req.project,
                typeOf: cinerino.factory.actionType.CheckAction,
                agent: req.agent,
                object: {
                    ...req.body,
                    movieTickets: (Array.isArray(req.body.movieTickets))
                        ? (<any[]>req.body.movieTickets).map((m) => {
                            return {
                                ...m,
                                typeOf: paymentMethodType
                            };
                        })
                        : [],
                    typeOf: paymentMethodType
                }
            })({
                action: new cinerino.repository.Action(mongoose.connection),
                project: new cinerino.repository.Project(mongoose.connection),
                movieTicket: new cinerino.repository.paymentMethod.MovieTicket({
                    endpoint: paymentServiceUrl,
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
// tslint:disable-next-line:use-default-type-parameter
movieTicketPaymentRouter.post<ParamsDictionary>(
    '/authorize',
    permitScopes(['transactions']),
    rateLimit,
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
            .isArray({ max: 10 }),
        body('object.additionalProperty.*.name')
            .optional()
            .not()
            .isEmpty()
            .isString()
            .isLength({ max: ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH }),
        body('object.additionalProperty.*.value')
            .optional()
            .not()
            .isEmpty()
            .isString()
            .isLength({ max: ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH }),
        body('object.movieTickets')
            .not()
            .isEmpty()
            .withMessage((_, __) => 'required')
            .isArray({ max: 20 })
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
            let paymentMethodType: cinerino.factory.paymentMethodType.MovieTicket | cinerino.factory.paymentMethodType.MGTicket
                = req.body.object?.typeOf;
            if (typeof paymentMethodType !== 'string') {
                paymentMethodType = cinerino.factory.paymentMethodType.MovieTicket;
            }

            const paymentServiceUrl = await getMvtKReserveEndpoint({
                project: { id: req.project.id },
                paymentMethodType: paymentMethodType
            });

            const action = await cinerino.service.payment.movieTicket.authorize({
                agent: { id: req.user.sub },
                object: {
                    typeOf: <any>paymentMethodType,
                    amount: 0,
                    additionalProperty: (Array.isArray(req.body.object.additionalProperty))
                        ? (<any[]>req.body.object.additionalProperty).map((p: any) => {
                            return { name: String(p.name), value: String(p.value) };
                        })
                        : [],
                    movieTickets: (<any[]>req.body.object.movieTickets).map((o) => {
                        return {
                            ...o,
                            typeOf: paymentMethodType
                        };
                    }),
                    ...(typeof req.body.object.name === 'string') ? { name: <string>req.body.object.name } : undefined
                },
                purpose: { typeOf: req.body.purpose.typeOf, id: <string>req.body.purpose.id }
            })({
                action: new cinerino.repository.Action(mongoose.connection),
                project: new cinerino.repository.Project(mongoose.connection),
                transaction: new cinerino.repository.Transaction(mongoose.connection),
                movieTicket: new cinerino.repository.paymentMethod.MovieTicket({
                    endpoint: paymentServiceUrl,
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
    permitScopes(['transactions']),
    rateLimit,
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
