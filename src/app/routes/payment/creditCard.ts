/**
 * クレジットカード決済ルーター
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

const chevreAuthClient = new cinerino.chevre.auth.ClientCredentials({
    domain: <string>process.env.CHEVRE_AUTHORIZE_SERVER_DOMAIN,
    clientId: <string>process.env.CHEVRE_CLIENT_ID,
    clientSecret: <string>process.env.CHEVRE_CLIENT_SECRET,
    scopes: [],
    state: ''
});

const ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH = (process.env.ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH !== undefined)
    ? Number(process.env.ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH)
    // tslint:disable-next-line:no-magic-numbers
    : 256;

const creditCardPaymentRouter = Router();

/**
 * クレジットカード決済承認
 */
// tslint:disable-next-line:use-default-type-parameter
creditCardPaymentRouter.post<ParamsDictionary>(
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
        body('object.paymentMethodId')
            .optional()
            .isString()
            .withMessage((_, options) => `${options.path} must be string`),
        body('object.orderId')
            .optional()
            .isString()
            .withMessage((_, options) => `${options.path} must be string`)
            .isLength({ max: 27 }),
        body('object.method')
            .not()
            .isEmpty()
            .withMessage((_, __) => 'required'),
        body('object.creditCard')
            .not()
            .isEmpty()
            .withMessage((_, __) => 'required')
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
            // 会員の場合のみmemberIdをセット
            let memberId = '';
            if (req.canReadPeopleMe) {
                const projectRepo = new cinerino.repository.Project(mongoose.connection);

                // 会員IDを強制的にログイン中の人物IDに変更
                const project = await projectRepo.findById({ id: req.project.id });
                const useUsernameAsGMOMemberId = project.settings?.useUsernameAsGMOMemberId === true;
                memberId = (useUsernameAsGMOMemberId) ? <string>req.user.username : req.user.sub;
            }

            const creditCard: cinerino.factory.action.authorize.paymentMethod.any.ICreditCard = {
                ...req.body.object.creditCard,
                memberId: memberId
            };

            const action = await cinerino.service.payment.chevre.authorize({
                project: req.project,
                agent: { id: req.user.sub },
                object: {
                    typeOf: cinerino.factory.action.authorize.paymentMethod.any.ResultType.Payment,
                    paymentMethod: cinerino.factory.paymentMethodType.CreditCard,
                    additionalProperty: (Array.isArray(req.body.object.additionalProperty))
                        ? (<any[]>req.body.object.additionalProperty).map((p: any) => {
                            return { name: String(p.name), value: String(p.value) };
                        })
                        : [],
                    amount: req.body.object.amount,
                    method: req.body.object.method,
                    creditCard: creditCard,
                    ...(typeof req.body.object.name === 'string') ? { name: <string>req.body.object.name } : undefined,
                    ...(typeof req.body.object.paymentMethodId === 'string')
                        ? { paymentMethodId: <string>req.body.object.paymentMethodId }
                        : undefined,
                    ...(typeof req.body.object.orderId === 'string') ? { orderId: <string>req.body.object.orderId } : undefined
                },
                purpose: { typeOf: req.body.purpose.typeOf, id: <string>req.body.purpose.id },
                paymentServiceType: cinerino.factory.service.paymentService.PaymentServiceType.CreditCard
            })({
                action: new cinerino.repository.Action(mongoose.connection),
                payTransaction: new cinerino.chevre.service.assetTransaction.Pay({
                    endpoint: cinerino.credentials.chevre.endpoint,
                    auth: chevreAuthClient,
                    project: { id: req.project.id }
                }),
                transaction: new cinerino.repository.Transaction(mongoose.connection),
                transactionNumber: new cinerino.chevre.service.TransactionNumber({
                    endpoint: cinerino.credentials.chevre.endpoint,
                    auth: req.chevreAuthClient,
                    project: { id: req.project.id }
                })
            });

            res.status(CREATED)
                .json({
                    ...action,
                    result: undefined
                });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * クレジットカード決済承認取消
 */
creditCardPaymentRouter.put(
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
                payTransaction: new cinerino.chevre.service.assetTransaction.Pay({
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

/**
 * 決済URL発行
 */
// tslint:disable-next-line:use-default-type-parameter
creditCardPaymentRouter.post<ParamsDictionary>(
    '/pubilshPaymentUrl',
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
            .isInt()
        // body('object.additionalProperty')
        //     .optional()
        //     .isArray({ max: 10 }),
        // body('object.additionalProperty.*.name')
        //     .optional()
        //     .not()
        //     .isEmpty()
        //     .isString()
        //     .isLength({ max: ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH }),
        // body('object.additionalProperty.*.value')
        //     .optional()
        //     .not()
        //     .isEmpty()
        //     .isString()
        //     .isLength({ max: ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH }),
        // body('object.orderId')
        //     .optional()
        //     .isString()
        //     .withMessage((_, options) => `${options.path} must be string`)
        //     .isLength({ max: 27 }),
        // body('object.method')
        //     .not()
        //     .isEmpty()
        //     .withMessage((_, __) => 'required'),
        // body('object.creditCard')
        //     .not()
        //     .isEmpty()
        //     .withMessage((_, __) => 'required')
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
            // 会員の場合のみmemberIdをセット
            let memberId = '';
            if (req.canReadPeopleMe) {
                const projectRepo = new cinerino.repository.Project(mongoose.connection);

                // 会員IDを強制的にログイン中の人物IDに変更
                const project = await projectRepo.findById({ id: req.project.id });
                const useUsernameAsGMOMemberId = project.settings?.useUsernameAsGMOMemberId === true;
                memberId = (useUsernameAsGMOMemberId) ? <string>req.user.username : req.user.sub;
            }

            const creditCard: cinerino.factory.action.authorize.paymentMethod.any.ICreditCard = {
                ...req.body.object.creditCard,
                memberId: memberId
            };

            const result = await cinerino.service.payment.chevre.publishPaymentUrl({
                project: req.project,
                agent: { id: req.user.sub },
                object: {
                    typeOf: cinerino.factory.action.authorize.paymentMethod.any.ResultType.Payment,
                    paymentMethod: cinerino.factory.paymentMethodType.CreditCard,
                    // additionalProperty: (Array.isArray(req.body.object.additionalProperty))
                    //     ? (<any[]>req.body.object.additionalProperty).map((p: any) => {
                    //         return { name: String(p.name), value: String(p.value) };
                    //     })
                    //     : [],
                    amount: req.body.object.amount,
                    // method: req.body.object.method,
                    creditCard: creditCard
                    // ...(typeof req.body.object.name === 'string') ? { name: <string>req.body.object.name } : undefined,
                    // ...(typeof req.body.object.orderId === 'string') ? { orderId: <string>req.body.object.orderId } : undefined
                },
                purpose: { typeOf: req.body.purpose.typeOf, id: <string>req.body.purpose.id },
                paymentServiceType: cinerino.factory.service.paymentService.PaymentServiceType.CreditCard
            })({
                payTransaction: new cinerino.chevre.service.assetTransaction.Pay({
                    endpoint: cinerino.credentials.chevre.endpoint,
                    auth: chevreAuthClient,
                    project: { id: req.project.id }
                }),
                transaction: new cinerino.repository.Transaction(mongoose.connection),
                transactionNumber: new cinerino.chevre.service.TransactionNumber({
                    endpoint: cinerino.credentials.chevre.endpoint,
                    auth: req.chevreAuthClient,
                    project: { id: req.project.id }
                })
            });

            res.json(result);
        } catch (error) {
            next(error);
        }
    }
);

export default creditCardPaymentRouter;
