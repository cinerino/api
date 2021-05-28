/**
 * プリペイドカード決済ルーター
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

const paymentCardPaymentRouter = Router();

/**
 * カード照会
 */
paymentCardPaymentRouter.post(
    '/check',
    permitScopes(['transactions']),
    rateLimit,
    validator,
    async (req, res, next) => {
        try {
            const serviceOutputService = new cinerino.chevre.service.ServiceOutput({
                endpoint: cinerino.credentials.chevre.endpoint,
                auth: chevreAuthClient,
                project: { id: req.project.id }
            });
            const searchPaymentCardResult = await serviceOutputService.search({
                limit: 1,
                page: 1,
                project: { typeOf: req.project.typeOf, id: req.project.id },
                typeOf: { $eq: req.body.object.typeOf },
                identifier: { $eq: req.body.object.identifier },
                accessCode: { $eq: req.body.object.accessCode }
            });
            if (searchPaymentCardResult.data.length === 0) {
                throw new cinerino.factory.errors.NotFound('PaymentCard');
            }
            const paymetCard = searchPaymentCardResult.data.shift();

            res.json({
                ...paymetCard,
                accessCode: undefined // アクセスコードをマスク
            });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * 口座確保
 */
// tslint:disable-next-line:use-default-type-parameter
paymentCardPaymentRouter.post<ParamsDictionary>(
    '/authorize',
    permitScopes(['transactions']),
    rateLimit,
    // 互換性維持のため
    (req, _, next) => {
        if (req.body.object === undefined || req.body.object === null) {
            req.body.object = {};
        }
        if (typeof req.body.object.notes === 'string') {
            req.body.object.description = req.body.object.notes;
        }
        if (typeof req.body.object?.fromAccount?.accountNumber === 'string') {
            if (req.body.object.fromLocation === undefined || req.body.object.fromLocation === null) {
                req.body.object.fromLocation = {};
            }
            req.body.object.fromLocation.identifier = req.body.object.fromAccount.accountNumber;
        }

        next();
    },
    ...[
        body('object.paymentMethod')
            .not()
            .isEmpty()
            .withMessage(() => 'required')
            .isString(),
        body('object.amount')
            .not()
            .isEmpty()
            .withMessage(() => 'required')
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
            .isLength({ max: ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH })
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
    // tslint:disable-next-line:max-func-body-length
    async (req, res, next) => {
        try {
            const actionRepo = new cinerino.repository.Action(mongoose.connection);
            const transactionRepo = new cinerino.repository.Transaction(mongoose.connection);

            const ownershipInfoService = new cinerino.chevre.service.OwnershipInfo({
                endpoint: cinerino.credentials.chevre.endpoint,
                auth: chevreAuthClient,
                project: { id: req.project.id }
            });

            let paymentCard: cinerino.factory.action.authorize.paymentMethod.any.IPaymentCard | undefined;

            const paymentMethodType: string = req.body.object?.paymentMethod;

            // トークン化された口座情報でリクエストされた場合、実口座情報へ変換する
            if (typeof req.body.object?.fromLocation === 'string') {
                type IPayload = cinerino.factory.ownershipInfo.IOwnershipInfo<cinerino.factory.ownershipInfo.IGood>;
                const accountOwnershipInfo = await cinerino.service.code.verifyToken<IPayload>({
                    project: req.project,
                    agent: req.agent,
                    token: req.body.object.fromLocation,
                    secret: <string>process.env.TOKEN_SECRET,
                    issuer: <string>process.env.RESOURCE_SERVER_IDENTIFIER
                })({ action: new cinerino.repository.Action(mongoose.connection) });
                const typeOfGood = <cinerino.factory.ownershipInfo.IServiceOutput>accountOwnershipInfo.typeOfGood;
                paymentCard = {
                    typeOf: typeOfGood.typeOf,
                    identifier: <string>typeOfGood.identifier
                };
            } else {
                const accessCode = req.body.object?.fromLocation?.accessCode;
                const accountIdentifier = req.body.object?.fromLocation?.identifier;

                if (typeof accountIdentifier === 'string') {
                    if (typeof accessCode === 'string') {
                        // アクセスコード情報があれば、認証
                        const serviceOutputService = new cinerino.chevre.service.ServiceOutput({
                            endpoint: cinerino.credentials.chevre.endpoint,
                            auth: chevreAuthClient,
                            project: { id: req.project.id }
                        });
                        const searchPaymentCardResult = await serviceOutputService.search({
                            limit: 1,
                            page: 1,
                            project: { typeOf: req.project.typeOf, id: req.project.id },
                            typeOf: { $eq: paymentMethodType },
                            identifier: { $eq: accountIdentifier },
                            accessCode: { $eq: accessCode }
                        });
                        if (searchPaymentCardResult.data.length === 0) {
                            throw new cinerino.factory.errors.NotFound('PaymentCard');
                        }
                        const paymetCard = searchPaymentCardResult.data.shift();
                        paymentCard = {
                            typeOf: paymetCard.typeOf,
                            identifier: paymetCard.identifier
                        };
                    } else {
                        // アクセスコード情報なし、かつ、会員の場合、所有権を確認
                        if (typeof req.user.username === 'string') {
                            // 口座に所有権があるかどうか確認
                            const searchOwnershipInfosResult = await ownershipInfoService.search({
                                limit: 1,
                                project: { id: { $eq: req.project.id } },
                                ownedBy: { id: req.user.sub },
                                ownedFrom: new Date(),
                                ownedThrough: new Date(),
                                typeOfGood: {
                                    typeOf: paymentMethodType,
                                    accountNumber: { $eq: accountIdentifier }
                                }
                            });
                            const paymentCardOwnershipInfos = searchOwnershipInfosResult.data;
                            if (paymentCardOwnershipInfos.length === 0) {
                                throw new cinerino.factory.errors.Forbidden('From Account access forbidden');
                            }

                            paymentCard = { typeOf: paymentMethodType, identifier: accountIdentifier };
                        }
                    }
                }
            }

            if (paymentCard === undefined) {
                throw new cinerino.factory.errors.ArgumentNull('From Location');
            }

            const action = await cinerino.service.payment.chevre.authorize({
                project: req.project,
                agent: { id: req.user.sub },
                object: {
                    typeOf: cinerino.factory.action.authorize.paymentMethod.any.ResultType.Payment,
                    paymentMethod: paymentMethodType,
                    additionalProperty: (Array.isArray(req.body.object.additionalProperty))
                        ? (<any[]>req.body.object.additionalProperty).map((p: any) => {
                            return { name: String(p.name), value: String(p.value) };
                        })
                        : [],
                    amount: Number(req.body.object.amount),
                    accountId: paymentCard.identifier,
                    ...(typeof req.body.object.name === 'string') ? { name: <string>req.body.object.name } : undefined,
                    ...(typeof req.body.object.description === 'string') ? { description: <string>req.body.object.description } : undefined
                },
                purpose: { typeOf: req.body.purpose.typeOf, id: <string>req.body.purpose.id },
                paymentServiceType: cinerino.factory.chevre.service.paymentService.PaymentServiceType.PaymentCard
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
 * 口座承認取消
 */
paymentCardPaymentRouter.put(
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

export default paymentCardPaymentRouter;
