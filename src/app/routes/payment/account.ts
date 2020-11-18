/**
 * 口座決済ルーター
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

const accountPaymentRouter = Router();

/**
 * 口座確保
 */
// tslint:disable-next-line:use-default-type-parameter
accountPaymentRouter.post<ParamsDictionary>(
    '/authorize',
    permitScopes(['transactions']),
    rateLimit,
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
            let fromAccount: cinerino.factory.action.authorize.paymentMethod.any.IFromAccount | undefined
                = req.body.object.fromAccount;

            const paymentMethodType: string = req.body.object?.paymentMethod;

            // トークン化された口座情報でリクエストされた場合、実口座情報へ変換する
            if (typeof fromAccount === 'string') {
                type IPayload = cinerino.factory.ownershipInfo.IOwnershipInfo<cinerino.factory.ownershipInfo.IGood>;
                const accountOwnershipInfo = await cinerino.service.code.verifyToken<IPayload>({
                    project: req.project,
                    agent: req.agent,
                    token: fromAccount,
                    secret: <string>process.env.TOKEN_SECRET,
                    issuer: <string>process.env.RESOURCE_SERVER_IDENTIFIER
                })({ action: new cinerino.repository.Action(mongoose.connection) });
                const account = <cinerino.factory.ownershipInfo.IAccount>accountOwnershipInfo.typeOfGood;
                fromAccount = account;
            } else {
                // 口座情報がトークンでない、かつ、APIユーザーが管理者でない場合、許可されるリクエストかどうか確認
                if (!req.isAdmin) {
                    if (fromAccount === undefined) {
                        // 入金処理は禁止
                        throw new cinerino.factory.errors.ArgumentNull('From Account');
                    } else {
                        // 口座に所有権があるかどうか確認
                        const ownershipInfoRepo = new cinerino.repository.OwnershipInfo(mongoose.connection);
                        const count = await ownershipInfoRepo.count({
                            limit: 1,
                            ownedBy: { id: req.user.sub },
                            ownedFrom: new Date(),
                            ownedThrough: new Date(),
                            typeOfGood: {
                                typeOf: paymentMethodType,
                                accountNumber: { $eq: fromAccount.accountNumber }
                            }
                        });
                        if (count === 0) {
                            throw new cinerino.factory.errors.Forbidden('From Account access forbidden');
                        }
                    }
                }
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
                    accountId: fromAccount?.accountNumber,
                    ...(typeof req.body.object.name === 'string') ? { name: <string>req.body.object.name } : undefined,
                    ...(typeof req.body.object.notes === 'string') ? { description: <string>req.body.object.notes } : undefined,
                    ...(typeof req.body.object.description === 'string')
                        ? { description: <string>req.body.object.description }
                        : undefined
                },
                purpose: { typeOf: req.body.purpose.typeOf, id: <string>req.body.purpose.id },
                paymentServiceType: cinerino.factory.chevre.service.paymentService.PaymentServiceType.PaymentCard
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
 * 口座承認取消
 */
accountPaymentRouter.put(
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
                transaction: new cinerino.repository.Transaction(mongoose.connection)
            });

            res.status(NO_CONTENT)
                .end();
        } catch (error) {
            next(error);
        }
    }
);

export default accountPaymentRouter;
