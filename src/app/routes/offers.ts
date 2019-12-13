/**
 * オファールーター
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';
// tslint:disable-next-line:no-implicit-dependencies
import { ParamsDictionary } from 'express-serve-static-core';
// tslint:disable-next-line:no-submodule-imports
import { body } from 'express-validator/check';
import { CREATED, NO_CONTENT } from 'http-status';
import * as mongoose from 'mongoose';

import lockTransaction from '../middlewares/lockTransaction';
import permitScopes from '../middlewares/permitScopes';
import rateLimit from '../middlewares/rateLimit';
import rateLimit4transactionInProgress from '../middlewares/rateLimit4transactionInProgress';
import validator from '../middlewares/validator';

const offersRouter = Router();

// tslint:disable-next-line:use-default-type-parameter
offersRouter.post<ParamsDictionary>(
    '/moneyTransfer/authorize',
    permitScopes(['customer', 'transactions']),
    rateLimit,
    ...[
        body('object')
            .not()
            .isEmpty(),
        body('object.amount')
            .not()
            .isEmpty()
            .withMessage(() => 'required')
            .isInt(),
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
            .isLength({ max: 256 }),
        body('object.additionalProperty.*.value')
            .optional()
            .not()
            .isEmpty()
            .isString()
            .isLength({ max: 512 }),
        body('recipient')
            .not()
            .isEmpty(),
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
            const action = await cinerino.service.offer.moneyTransfer.authorize({
                project: req.project,
                object: {
                    typeOf: cinerino.factory.actionType.MoneyTransfer,
                    amount: Number(req.body.object.amount),
                    toLocation: req.body.object.toLocation
                    // additionalProperty: (Array.isArray(req.body.object.additionalProperty))
                    //     ? (<any[]>req.body.object.additionalProperty).map((p: any) => {
                    //         return { name: String(p.name), value: String(p.value) };
                    //     })
                    //     : [],
                },
                agent: { id: req.user.sub },
                recipient: req.body.recipient,
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

// tslint:disable-next-line:use-default-type-parameter
offersRouter.put<ParamsDictionary>(
    '/moneyTransfer/authorize/:actionId/void',
    permitScopes(['customer', 'transactions']),
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
            await cinerino.service.offer.moneyTransfer.voidTransaction({
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
