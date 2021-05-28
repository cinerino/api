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

import * as redis from '../../../redis';

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
            let paymentMethodType: string = req.body.typeOf;
            if (typeof paymentMethodType !== 'string') {
                paymentMethodType = cinerino.factory.paymentMethodType.MovieTicket;
            }

            const payService = new cinerino.chevre.service.assetTransaction.Pay({
                endpoint: cinerino.credentials.chevre.endpoint,
                auth: chevreAuthClient,
                project: { id: req.project.id }
            });
            const checkAction = await payService.check({
                project: { id: req.project.id, typeOf: cinerino.chevre.factory.organizationType.Project },
                typeOf: cinerino.chevre.factory.actionType.CheckAction,
                agent: req.agent,
                object: [{
                    typeOf: cinerino.chevre.factory.service.paymentService.PaymentServiceType.MovieTicket,
                    paymentMethod: {
                        typeOf: paymentMethodType,
                        additionalProperty: [],
                        name: paymentMethodType,
                        paymentMethodId: '' // 使用されないので空でよし
                    },
                    movieTickets: (Array.isArray(req.body.movieTickets))
                        ? (<any[]>req.body.movieTickets).map((m) => {
                            return {
                                ...m,
                                typeOf: paymentMethodType
                            };
                        })
                        : [],
                    seller: req.body.seller
                }]
            });

            const action: cinerino.factory.action.check.paymentMethod.movieTicket.IAction = {
                id: checkAction.id,
                project: { id: req.project.id, typeOf: req.project.typeOf },
                typeOf: cinerino.factory.actionType.CheckAction,
                agent: req.agent,
                // tslint:disable-next-line:no-suspicious-comment
                // TODO ひとまず強制型変換しているが、checkAction.objectのままで問題なければ変更する
                object: <any>{
                    typeOf: paymentMethodType,
                    movieTickets: (Array.isArray(checkAction.object[0]?.movieTickets)) ? checkAction.object[0]?.movieTickets : [],
                    seller: checkAction.object[0]?.seller
                },
                actionStatus: checkAction.actionStatus,
                startDate: checkAction.startDate,
                endDate: checkAction.endDate,
                result: checkAction.result
            };

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
            const actionRepo = new cinerino.repository.Action(mongoose.connection);
            const transactionRepo = new cinerino.repository.Transaction(mongoose.connection);
            const confirmationNumberRepo = new cinerino.repository.ConfirmationNumber(redis.getClient());

            let paymentMethodType: cinerino.factory.paymentMethodType.MovieTicket | cinerino.factory.paymentMethodType.MGTicket
                = req.body.object?.paymentMethod;
            if (typeof paymentMethodType !== 'string') {
                paymentMethodType = cinerino.factory.paymentMethodType.MovieTicket;
            }

            // 注文確認番号を発行(MovieTicket着券に連携するため)
            await cinerino.service.transaction.placeOrderInProgress.publishConfirmationNumberIfNotExist({
                id: <string>req.body.purpose.id,
                object: { orderDate: new Date() }
            })({
                confirmationNumber: confirmationNumberRepo,
                transaction: transactionRepo
            });

            const action = await cinerino.service.payment.chevre.authorize({
                project: req.project,
                agent: { id: req.user.sub },
                object: {
                    // typeOf: paymentMethodType,
                    typeOf: cinerino.factory.action.authorize.paymentMethod.any.ResultType.Payment,
                    paymentMethod: paymentMethodType,
                    amount: 0, // 固定で0指定(金額として0)
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
                purpose: { typeOf: req.body.purpose.typeOf, id: <string>req.body.purpose.id },
                paymentServiceType: cinerino.factory.chevre.service.paymentService.PaymentServiceType.MovieTicket
            })({
                action: actionRepo,
                transaction: transactionRepo,
                transactionNumber: new cinerino.chevre.service.TransactionNumber({
                    endpoint: cinerino.credentials.chevre.endpoint,
                    auth: req.chevreAuthClient,
                    project: { id: req.project.id }
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
            await cinerino.service.payment.chevre.voidPayment({
                project: { id: req.project.id, typeOf: req.project.typeOf },
                agent: { id: req.user.sub },
                id: req.params.actionId,
                purpose: { typeOf: req.body.purpose.typeOf, id: <string>req.body.purpose.id }
            })({
                action: new cinerino.repository.Action(mongoose.connection),
                assetTransaction: new cinerino.chevre.service.AssetTransaction({
                    endpoint: cinerino.credentials.chevre.endpoint,
                    auth: chevreAuthClient,
                    project: { id: req.project.id }
                }),
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
