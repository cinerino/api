/**
 * プロダクトオファールーター
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';
// tslint:disable-next-line:no-implicit-dependencies
import { ParamsDictionary } from 'express-serve-static-core';
import { body } from 'express-validator';
import { CREATED, NO_CONTENT } from 'http-status';
import * as mongoose from 'mongoose';

import * as redis from '../../../redis';

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

const productOffersRouter = Router();

// アクセスコートは4桁の数字で固定
const accessCodeMustBe = /^[0-9]{4}$/;

// tslint:disable-next-line:use-default-type-parameter
productOffersRouter.post<ParamsDictionary>(
    '/authorize',
    permitScopes(['transactions']),
    rateLimit,
    (req, _, next) => {
        // objectが配列でない場合は強制変換
        if (!Array.isArray(req.body.object)) {
            req.body.object = [req.body.object];
        }

        next();
    },
    ...[
        body('object.*.id')
            .not()
            .isEmpty()
            .withMessage(() => 'required'),
        body('object.*.itemOffered.id')
            .not()
            .isEmpty()
            .withMessage(() => 'required'),
        body('object.*.itemOffered.serviceOutput.accessCode')
            .not()
            .isEmpty()
            .withMessage(() => 'required')
            .isString()
            .custom((value) => {
                if (!accessCodeMustBe.test(value)) {
                    throw new Error('accessCode must be 4 digits of number');
                }

                return true;
            }),
        body('object.*.itemOffered.serviceOutput.additionalProperty')
            .optional()
            .isArray({ max: 10 }),
        body('object.*.itemOffered.serviceOutput.additionalProperty.*.name')
            .optional()
            .not()
            .isEmpty()
            .isString()
            .isLength({ max: ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH }),
        body('object.*.itemOffered.serviceOutput.additionalProperty.*.value')
            .optional()
            .not()
            .isEmpty()
            .isString()
            .isLength({ max: ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH }),
        body('purpose')
            .not()
            .isEmpty()
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
            const ownershipInfoService = new cinerino.chevre.service.OwnershipInfo({
                endpoint: cinerino.credentials.chevre.endpoint,
                auth: chevreAuthClient,
                project: { id: req.project.id }
            });
            const productService = new cinerino.chevre.service.Product({
                endpoint: cinerino.credentials.chevre.endpoint,
                auth: req.chevreAuthClient,
                project: { id: req.project.id }
            });

            const actionObject: cinerino.factory.action.authorize.offer.product.IObject = (<any[]>req.body.object).map((o) => {
                return {
                    project: req.project,
                    typeOf: cinerino.factory.chevre.offerType.Offer,
                    id: o?.id,
                    priceCurrency: cinerino.factory.chevre.priceCurrency.JPY,
                    itemOffered: {
                        ...o?.itemOffered,
                        project: req.project,
                        typeOf: o?.itemOffered?.typeOf,
                        id: o?.itemOffered?.id,
                        serviceOutput: {
                            project: req.project,
                            typeOf: o?.itemOffered?.serviceOutput?.typeOf,
                            accessCode: o?.itemOffered?.serviceOutput?.accessCode,
                            name: o?.itemOffered?.serviceOutput?.name,
                            ...(Array.isArray(o?.itemOffered?.serviceOutput?.additionalProperty))
                                ? { additionalProperty: o.itemOffered.serviceOutput.additionalProperty }
                                : undefined
                        }
                    },
                    seller: <any>{} // この指定は実質無視される
                    // additionalProperty: (Array.isArray(req.body.object.additionalProperty))
                    //     ? (<any[]>req.body.object.additionalProperty).map((p: any) => {
                    //         return { name: String(p.name), value: String(p.value) };
                    //     })
                    //     : [],
                };
            });

            const action = await cinerino.service.offer.product.authorize({
                project: req.project,
                object: actionObject,
                agent: { id: req.user.sub, typeOf: req.agent.typeOf },
                transaction: <any>{ typeOf: req.body.purpose.typeOf, id: <string>req.body.purpose.id }
            })({
                action: new cinerino.repository.Action(mongoose.connection),
                orderNumber: new cinerino.repository.OrderNumber(redis.getClient()),
                ownershipInfo: ownershipInfoService,
                product: productService,
                registerActionInProgress: new cinerino.repository.action.RegisterServiceInProgress(redis.getClient()),
                serviceOutput: new cinerino.chevre.service.ServiceOutput({
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
                .json(action);
        } catch (error) {
            next(error);
        }
    }
);

// tslint:disable-next-line:use-default-type-parameter
productOffersRouter.put<ParamsDictionary>(
    '/authorize/:actionId/void',
    permitScopes(['transactions']),
    rateLimit,
    ...[
        body('purpose')
            .not()
            .isEmpty()
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
            await cinerino.service.offer.product.voidTransaction({
                id: req.params.actionId,
                agent: { id: req.user.sub },
                project: req.project,
                purpose: { typeOf: req.body.purpose.typeOf, id: <string>req.body.purpose.id }
            })({
                action: new cinerino.repository.Action(mongoose.connection),
                assetTransaction: new cinerino.chevre.service.AssetTransaction({
                    endpoint: cinerino.credentials.chevre.endpoint,
                    auth: chevreAuthClient,
                    project: { id: req.project.id }
                }),
                registerActionInProgress: new cinerino.repository.action.RegisterServiceInProgress(redis.getClient()),
                transaction: new cinerino.repository.Transaction(mongoose.connection)
            });

            res.status(NO_CONTENT)
                .end();
        } catch (error) {
            next(error);
        }
    }
);

export default productOffersRouter;
