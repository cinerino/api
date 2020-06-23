/**
 * オファールーター
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';
// tslint:disable-next-line:no-implicit-dependencies
import { ParamsDictionary } from 'express-serve-static-core';
import { body } from 'express-validator';
import { CREATED } from 'http-status';
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

const paymentCardOffersRouter = Router();

// tslint:disable-next-line:use-default-type-parameter
paymentCardOffersRouter.post<ParamsDictionary>(
    '/authorize',
    permitScopes(['transactions']),
    rateLimit,
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
            .withMessage(() => 'required'),
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
            let object: any[] = req.body.object;
            if (!Array.isArray(object)) {
                object = [object];
            }

            const action = await cinerino.service.offer.product.authorize({
                project: req.project,
                object: object.map((o: any) => {
                    return {
                        project: req.project,
                        typeOf: cinerino.factory.chevre.offerType.Offer,
                        id: o?.id,
                        priceCurrency: cinerino.factory.chevre.priceCurrency.JPY,
                        itemOffered: {
                            project: req.project,
                            typeOf: o?.itemOffered?.typeOf,
                            id: o?.itemOffered?.id,
                            serviceOutput: {
                                project: req.project,
                                typeOf: o?.itemOffered?.serviceOutput?.typeOf,
                                accessCode: o?.itemOffered?.serviceOutput?.accessCode,
                                name: o?.itemOffered?.serviceOutput?.name
                                // additionalProperty: [
                                //     { name: 'accountNumber', value: identifier },
                                // ]
                            }
                        },
                        seller: <any>{} // この指定は実質無視される
                        // additionalProperty: (Array.isArray(req.body.object.additionalProperty))
                        //     ? (<any[]>req.body.object.additionalProperty).map((p: any) => {
                        //         return { name: String(p.name), value: String(p.value) };
                        //     })
                        //     : [],
                    };
                }),
                agent: { id: req.user.sub },
                transaction: <any>{ typeOf: req.body.purpose.typeOf, id: <string>req.body.purpose.id }
            })({
                accountNumber: new cinerino.repository.AccountNumber(redis.getClient()),
                action: new cinerino.repository.Action(mongoose.connection),
                ownershipInfo: new cinerino.repository.OwnershipInfo(mongoose.connection),
                project: new cinerino.repository.Project(mongoose.connection),
                registerActionInProgress: new cinerino.repository.action.RegisterServiceInProgress(redis.getClient()),
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
// paymentCardOffersRouter.put<ParamsDictionary>(
//     '/authorize/:actionId/void',
//     permitScopes(['transactions']),
//     rateLimit,
//     ...[
//         body('purpose')
//             .not()
//             .isEmpty()
//     ],
//     validator,
//     async (req, res, next) => {
//         await rateLimit4transactionInProgress({
//             typeOf: req.body.purpose.typeOf,
//             id: <string>req.body.purpose.id
//         })(req, res, next);
//     },
//     async (req, res, next) => {
//         await lockTransaction({
//             typeOf: req.body.purpose.typeOf,
//             id: <string>req.body.purpose.id
//         })(req, res, next);
//     },
//     async (req, res, next) => {
//         try {
//             await cinerino.service.offer.paymentCard.voidTransaction({
//                 project: req.project,
//                 id: req.params.actionId,
//                 agent: { id: req.user.sub },
//                 purpose: { typeOf: req.body.purpose.typeOf, id: <string>req.body.purpose.id }
//             })({
//                 action: new cinerino.repository.Action(mongoose.connection),
//                 project: new cinerino.repository.Project(mongoose.connection),
//                 transaction: new cinerino.repository.Transaction(mongoose.connection)
//             });

//             res.status(NO_CONTENT)
//                 .end();
//         } catch (error) {
//             next(error);
//         }
//     }
// );

export default paymentCardOffersRouter;
