/**
 * オファールーター
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';
// tslint:disable-next-line:no-implicit-dependencies
import { ParamsDictionary } from 'express-serve-static-core';
import { body } from 'express-validator';
import { CREATED, NO_CONTENT } from 'http-status';
import * as mongoose from 'mongoose';

import lockTransaction from '../middlewares/lockTransaction';
import permitScopes from '../middlewares/permitScopes';
import rateLimit from '../middlewares/rateLimit';
import rateLimit4transactionInProgress from '../middlewares/rateLimit4transactionInProgress';
import validator from '../middlewares/validator';

import { Permission } from '../iam';

const ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH = (process.env.ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH !== undefined)
    ? Number(process.env.ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH)
    // tslint:disable-next-line:no-magic-numbers
    : 256;

const offersRouter = Router();

if (process.env.USE_MONEY_TRANSFER === '1') {
    // tslint:disable-next-line:use-default-type-parameter
    offersRouter.post<ParamsDictionary>(
        '/monetaryAmount/authorize',
        permitScopes([Permission.User, 'transactions']),
        rateLimit,
        ...[
            body('object')
                .not()
                .isEmpty(),
            body('object.itemOffered')
                .not()
                .isEmpty(),
            body('object.itemOffered.value')
                .not()
                .isEmpty()
                .withMessage(() => 'required')
                .isInt()
                .toInt(),
            body('object.toLocation')
                .not()
                .isEmpty()
                .withMessage(() => 'required'),
            body('object.toLocation.accountType')
                .isIn([cinerino.factory.accountType.Coin])
                .withMessage(() => `must be "${cinerino.factory.accountType.Coin}"`),
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
                const action = await cinerino.service.offer.monetaryAmount.authorize({
                    project: req.project,
                    object: {
                        typeOf: 'Offer',
                        itemOffered: {
                            typeOf: 'MonetaryAmount',
                            value: Number(req.body.object.itemOffered.value),
                            currency: req.body.object.toLocation.accountType
                        },
                        seller: <any>{},
                        priceCurrency: cinerino.factory.priceCurrency.JPY,
                        // typeOf: cinerino.factory.actionType.MoneyTransfer,
                        // amount: Number(req.body.object.amount),
                        toLocation: req.body.object.toLocation
                        // additionalProperty: (Array.isArray(req.body.object.additionalProperty))
                        //     ? (<any[]>req.body.object.additionalProperty).map((p: any) => {
                        //         return { name: String(p.name), value: String(p.value) };
                        //     })
                        //     : [],
                    },
                    agent: { id: req.user.sub },
                    purpose: { typeOf: req.body.purpose.typeOf, id: <string>req.body.purpose.id }
                })({
                    action: new cinerino.repository.Action(mongoose.connection),
                    project: new cinerino.repository.Project(mongoose.connection),
                    seller: new cinerino.repository.Seller(mongoose.connection),
                    transaction: new cinerino.repository.Transaction(mongoose.connection)
                });

                res.status(CREATED)
                    .json(action);
            } catch (error) {
                next(error);
            }
        }
    );
}

// tslint:disable-next-line:use-default-type-parameter
offersRouter.put<ParamsDictionary>(
    '/monetaryAmount/authorize/:actionId/void',
    permitScopes([Permission.User, 'transactions']),
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
            await cinerino.service.offer.monetaryAmount.voidTransaction({
                project: req.project,
                id: req.params.actionId,
                agent: { id: req.user.sub },
                purpose: { typeOf: req.body.purpose.typeOf, id: <string>req.body.purpose.id }
            })({
                action: new cinerino.repository.Action(mongoose.connection),
                project: new cinerino.repository.Project(mongoose.connection),
                transaction: new cinerino.repository.Transaction(mongoose.connection)
            });

            res.status(NO_CONTENT)
                .end();
        } catch (error) {
            next(error);
        }
    }
);

export default offersRouter;
