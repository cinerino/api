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

import { Permission } from '../../iam';

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
    permitScopes([Permission.User, 'customer', 'transactions']),
    rateLimit,
    ...[
        body('object')
            .not()
            .isEmpty(),
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
    // tslint:disable-next-line:max-func-body-length
    async (req, res, next) => {
        try {
            let fromAccount: cinerino.factory.action.authorize.paymentMethod.account.IFromAccount<cinerino.factory.accountType> | undefined
                = req.body.object.fromAccount;
            let toAccount: cinerino.factory.action.authorize.paymentMethod.account.IToAccount<cinerino.factory.accountType> | undefined
                = req.body.object.toAccount;

            // トークン化された口座情報でリクエストされた場合、実口座情報へ変換する
            if (typeof fromAccount === 'string') {
                // tslint:disable-next-line:max-line-length
                type IPayload = cinerino.factory.ownershipInfo.IOwnershipInfo<cinerino.factory.ownershipInfo.IGood<cinerino.factory.ownershipInfo.AccountGoodType.Account>>;
                const accountOwnershipInfo = await cinerino.service.code.verifyToken<IPayload>({
                    project: req.project,
                    agent: req.agent,
                    token: fromAccount,
                    secret: <string>process.env.TOKEN_SECRET,
                    issuer: <string>process.env.RESOURCE_SERVER_IDENTIFIER
                })({ action: new cinerino.repository.Action(mongoose.connection) });
                const account = accountOwnershipInfo.typeOfGood;
                if (account.accountType !== cinerino.factory.accountType.Coin) {
                    throw new cinerino.factory.errors.Argument('fromAccount', 'Invalid token');
                }
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
                        const count = await ownershipInfoRepo.count<cinerino.factory.ownershipInfo.AccountGoodType.Account>({
                            limit: 1,
                            ownedBy: { id: req.user.sub },
                            ownedFrom: new Date(),
                            ownedThrough: new Date(),
                            typeOfGood: {
                                typeOf: cinerino.factory.ownershipInfo.AccountGoodType.Account,
                                accountType: fromAccount.accountType,
                                accountNumber: fromAccount.accountNumber
                            }
                        });
                        if (count === 0) {
                            throw new cinerino.factory.errors.Forbidden('From Account access forbidden');
                        }
                    }
                }
            }

            const accountType = (fromAccount !== undefined)
                ? fromAccount.accountType
                : (toAccount !== undefined) ? toAccount.accountType : undefined;

            const actionRepo = new cinerino.repository.Action(mongoose.connection);
            const projectRepo = new cinerino.repository.Project(mongoose.connection);
            const sellerRepo = new cinerino.repository.Seller(mongoose.connection);
            const transactionRepo = new cinerino.repository.Transaction(mongoose.connection);

            // 注文取引、かつ、toAccount未指定の場合、販売者の口座を検索して、toAccountにセット
            if (toAccount === undefined) {
                const transaction = await transactionRepo.findById({
                    typeOf: req.body.purpose.typeOf,
                    id: <string>req.body.purpose.id
                });

                if (transaction.typeOf === cinerino.factory.transactionType.PlaceOrder) {
                    const seller = await sellerRepo.findById({
                        id: transaction.seller.id
                    });

                    if (seller.paymentAccepted === undefined) {
                        throw new cinerino.factory.errors.Argument('object', 'Account payment not accepted');
                    }
                    const accountPaymentsAccepted = <cinerino.factory.seller.IPaymentAccepted<cinerino.factory.paymentMethodType.Account>[]>
                        seller.paymentAccepted.filter((a) => a.paymentMethodType === cinerino.factory.paymentMethodType.Account);
                    const paymentAccepted = accountPaymentsAccepted.find((a) => a.accountType === accountType);
                    // tslint:disable-next-line:no-single-line-block-comment
                    /* istanbul ignore if */
                    if (paymentAccepted === undefined) {
                        throw new cinerino.factory.errors.Argument('object', `${accountType} payment not accepted`);
                    }
                    toAccount = {
                        accountNumber: paymentAccepted.accountNumber,
                        accountType: paymentAccepted.accountType
                    };
                }
            }

            const currency = (accountType === cinerino.factory.accountType.Coin)
                ? cinerino.factory.priceCurrency.JPY
                : accountType;

            const action = await cinerino.service.payment.account.authorize({
                project: req.project,
                object: {
                    typeOf: cinerino.factory.paymentMethodType.Account,
                    amount: Number(req.body.object.amount),
                    currency: currency,
                    additionalProperty: (Array.isArray(req.body.object.additionalProperty))
                        ? (<any[]>req.body.object.additionalProperty).map((p: any) => {
                            return { name: String(p.name), value: String(p.value) };
                        })
                        : [],
                    ...(typeof req.body.object.name === 'string') ? { name: <string>req.body.object.name } : undefined,
                    ...(typeof req.body.object.notes === 'string') ? { notes: <string>req.body.object.notes } : undefined,
                    ...(fromAccount !== undefined) ? { fromAccount } : {},
                    ...(toAccount !== undefined) ? { toAccount } : {}
                },
                agent: { id: req.user.sub },
                purpose: { typeOf: req.body.purpose.typeOf, id: <string>req.body.purpose.id }
            })({
                action: actionRepo,
                project: projectRepo,
                transaction: transactionRepo
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
    permitScopes([Permission.User, 'customer', 'transactions']),
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
            await cinerino.service.payment.account.voidTransaction({
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

export default accountPaymentRouter;
