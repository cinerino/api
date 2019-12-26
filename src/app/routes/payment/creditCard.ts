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

const creditCardPaymentRouter = Router();

/**
 * クレジットカード決済承認
 */
// tslint:disable-next-line:use-default-type-parameter
creditCardPaymentRouter.post<ParamsDictionary>(
    '/authorize',
    permitScopes(['customer', 'transactions']),
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
            const projectRepo = new cinerino.repository.Project(mongoose.connection);
            const project = await projectRepo.findById({ id: req.project.id });
            const useUsernameAsGMOMemberId = project.settings !== undefined && project.settings.useUsernameAsGMOMemberId === true;

            // 会員IDを強制的にログイン中の人物IDに変更
            type ICreditCard4authorizeAction = cinerino.factory.action.authorize.paymentMethod.creditCard.ICreditCard;
            const memberId = (useUsernameAsGMOMemberId) ? <string>req.user.username : req.user.sub;
            const creditCard: ICreditCard4authorizeAction = {
                ...req.body.object.creditCard,
                memberId: memberId
            };

            const action = await cinerino.service.payment.creditCard.authorize({
                project: req.project,
                agent: { id: req.user.sub },
                object: {
                    typeOf: cinerino.factory.paymentMethodType.CreditCard,
                    additionalProperty: (Array.isArray(req.body.object.additionalProperty))
                        ? (<any[]>req.body.object.additionalProperty).map((p: any) => {
                            return { name: String(p.name), value: String(p.value) };
                        })
                        : [],
                    amount: req.body.object.amount,
                    method: req.body.object.method,
                    creditCard: creditCard,
                    ...(typeof req.body.object.name === 'string') ? { name: <string>req.body.object.name } : undefined,
                    ...(typeof req.body.object.orderId === 'string') ? { orderId: <string>req.body.object.orderId } : undefined
                },
                purpose: { typeOf: req.body.purpose.typeOf, id: <string>req.body.purpose.id }
            })({
                action: new cinerino.repository.Action(mongoose.connection),
                project: projectRepo,
                transaction: new cinerino.repository.Transaction(mongoose.connection),
                seller: new cinerino.repository.Seller(mongoose.connection)
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
    permitScopes(['customer', 'transactions']),
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
            await cinerino.service.payment.creditCard.voidTransaction({
                project: { id: req.project.id },
                agent: { id: req.user.sub },
                id: req.params.actionId,
                purpose: { typeOf: req.body.purpose.typeOf, id: <string>req.body.purpose.id }
            })({
                action: new cinerino.repository.Action(mongoose.connection),
                project: new cinerino.repository.Project(mongoose.connection),
                seller: new cinerino.repository.Seller(mongoose.connection),
                transaction: new cinerino.repository.Transaction(mongoose.connection)
            });

            res.status(NO_CONTENT)
                .end();
        } catch (error) {
            next(error);
        }
    }
);

export default creditCardPaymentRouter;
