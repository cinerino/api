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

const ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH = (process.env.ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH !== undefined)
    ? Number(process.env.ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH)
    // tslint:disable-next-line:no-magic-numbers
    : 256;

const anyPaymentRouter = Router();

/**
 * 汎用決済承認
 */
// tslint:disable-next-line:use-default-type-parameter
anyPaymentRouter.post<ParamsDictionary>(
    '/authorize',
    permitScopes(['pos', 'payment.any.write']),
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
    async (req, res, next) => {
        try {
            const action = await cinerino.service.payment.any.authorize({
                agent: { id: req.user.sub },
                object: {
                    ...req.body.object,
                    // typeOf: cinerino.factory.action.authorize.paymentMethod.any.ResultType.Payment,
                    additionalProperty: (Array.isArray(req.body.object.additionalProperty))
                        ? (<any[]>req.body.object.additionalProperty).map((p: any) => {
                            return { name: String(p.name), value: String(p.value) };
                        })
                        : [],
                    ...(typeof req.body.object.name === 'string') ? { name: <string>req.body.object.name } : undefined
                },
                purpose: { typeOf: req.body.purpose.typeOf, id: <string>req.body.purpose.id }
            })({
                action: new cinerino.repository.Action(mongoose.connection),
                transaction: new cinerino.repository.Transaction(mongoose.connection)
            });

            res.status(CREATED)
                .json(action);
        } catch (error) {
            next(error);
        }
    }
);

/**
 * 汎用決済承認取消
 */
anyPaymentRouter.put(
    '/authorize/:actionId/void',
    permitScopes(['payment.any.write']),
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
            await cinerino.service.payment.any.voidTransaction({
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

export default anyPaymentRouter;
