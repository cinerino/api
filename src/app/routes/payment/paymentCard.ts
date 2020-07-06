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
            const projectRepo = new cinerino.repository.Project(mongoose.connection);
            const project = await projectRepo.findById({ id: req.project.id });
            if (typeof project.settings?.chevre?.endpoint !== 'string') {
                throw new cinerino.factory.errors.ServiceUnavailable('Project settings not found');
            }

            const serviceOutputService = new cinerino.chevre.service.ServiceOutput({
                endpoint: project.settings.chevre.endpoint,
                auth: chevreAuthClient
            });
            const searchPaymentCardResult = await serviceOutputService.search({
                limit: 1,
                page: 1,
                project: { typeOf: 'Project', id: req.project.id },
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
            const actionRepo = new cinerino.repository.Action(mongoose.connection);
            const projectRepo = new cinerino.repository.Project(mongoose.connection);
            // const sellerRepo = new cinerino.repository.Seller(mongoose.connection);
            const transactionRepo = new cinerino.repository.Transaction(mongoose.connection);

            let fromLocation: cinerino.factory.action.authorize.paymentMethod.paymentCard.IFromLocation | undefined
                = req.body.object.fromLocation;

            // トークン化された口座情報でリクエストされた場合、実口座情報へ変換する
            if (typeof fromLocation === 'string') {
                // tslint:disable-next-line:max-line-length
                type IPayload = cinerino.factory.ownershipInfo.IOwnershipInfo<cinerino.factory.ownershipInfo.IGood<any>>;
                const accountOwnershipInfo = await cinerino.service.code.verifyToken<IPayload>({
                    project: req.project,
                    agent: req.agent,
                    token: fromLocation,
                    secret: <string>process.env.TOKEN_SECRET,
                    issuer: <string>process.env.RESOURCE_SERVER_IDENTIFIER
                })({ action: new cinerino.repository.Action(mongoose.connection) });
                const paymentCard = accountOwnershipInfo.typeOfGood;
                fromLocation = {
                    typeOf: paymentCard.typeOf,
                    identifier: paymentCard.identifier
                };
            } else {
                const accessCode = fromLocation?.accessCode;
                if (typeof accessCode === 'string') {
                    // アクセスコード情報があれば、認証
                    const project = await projectRepo.findById({ id: req.project.id });
                    if (typeof project.settings?.chevre?.endpoint !== 'string') {
                        throw new cinerino.factory.errors.ServiceUnavailable('Project settings not found');
                    }

                    const serviceOutputService = new cinerino.chevre.service.ServiceOutput({
                        endpoint: project.settings.chevre.endpoint,
                        auth: chevreAuthClient
                    });
                    const searchPaymentCardResult = await serviceOutputService.search({
                        limit: 1,
                        page: 1,
                        project: { typeOf: 'Project', id: req.project.id },
                        typeOf: { $eq: fromLocation?.typeOf },
                        identifier: { $eq: fromLocation?.identifier },
                        accessCode: { $eq: accessCode }
                    });
                    if (searchPaymentCardResult.data.length === 0) {
                        throw new cinerino.factory.errors.NotFound('PaymentCard');
                    }
                    const paymetCard = searchPaymentCardResult.data.shift();
                    fromLocation = {
                        typeOf: paymetCard.typeOf,
                        identifier: paymetCard.identifier
                    };
                } else {
                    fromLocation = undefined;
                    // アクセスコード情報なし、かつ、会員の場合、所有権を確認
                    // 口座に所有権があるかどうか確認
                    // const ownershipInfoRepo = new cinerino.repository.OwnershipInfo(mongoose.connection);
                    // const count = await ownershipInfoRepo.count<cinerino.factory.ownershipInfo.AccountGoodType.Account>({
                    //     limit: 1,
                    //     ownedBy: { id: req.user.sub },
                    //     ownedFrom: new Date(),
                    //     ownedThrough: new Date(),
                    //     typeOfGood: {
                    //         typeOf: cinerino.factory.ownershipInfo.AccountGoodType.Account,
                    //         accountType: fromLocation.accountType,
                    //         accountNumber: fromLocation.accountNumber
                    //     }
                    // });
                    // if (count === 0) {
                    //     throw new cinerino.factory.errors.Forbidden('From Account access forbidden');
                    // }
                }
            }

            if (fromLocation === undefined) {
                // 入金処理は禁止
                throw new cinerino.factory.errors.ArgumentNull('From Location');
            }

            // 注文取引、かつ、toAccount未指定の場合、販売者の口座を検索して、toAccountにセット
            // if (toLocation === undefined) {
            //     const transaction = await transactionRepo.findById({
            //         typeOf: req.body.purpose.typeOf,
            //         id: <string>req.body.purpose.id
            //     });

            //     if (transaction.typeOf === cinerino.factory.transactionType.PlaceOrder) {
            //         const seller = await sellerRepo.findById({
            //             id: transaction.seller.id
            //         });

            //         if (seller.paymentAccepted === undefined) {
            //             throw new cinerino.factory.errors.Argument('object', 'Account payment not accepted');
            //         }
            //         const accountPaymentsAccepted =
            //             <cinerino.factory.seller.IPaymentAccepted<cinerino.factory.paymentMethodType.PaymentCard>[]>
            //             seller.paymentAccepted.filter((a) => a.paymentMethodType === cinerino.factory.paymentMethodType.PaymentCard);
            //         const paymentAccepted = accountPaymentsAccepted.find((a) => a.accountType === accountType);
            //         // tslint:disable-next-line:no-single-line-block-comment
            //         /* istanbul ignore if */
            //         if (paymentAccepted === undefined) {
            //             throw new cinerino.factory.errors.Argument('object', `${accountType} payment not accepted`);
            //         }
            //         toLocation = {
            //             accountNumber: paymentAccepted.accountNumber,
            //             accountType: paymentAccepted.accountType
            //         };
            //     }
            // }

            const currency = cinerino.factory.priceCurrency.JPY;

            const action = await cinerino.service.payment.paymentCard.authorize({
                project: req.project,
                object: {
                    typeOf: cinerino.factory.paymentMethodType.PaymentCard,
                    amount: Number(req.body.object.amount),
                    currency: currency,
                    additionalProperty: (Array.isArray(req.body.object.additionalProperty))
                        ? (<any[]>req.body.object.additionalProperty).map((p: any) => {
                            return { name: String(p.name), value: String(p.value) };
                        })
                        : [],
                    ...(typeof req.body.object.name === 'string') ? { name: <string>req.body.object.name } : undefined,
                    ...(fromLocation !== undefined) ? { fromLocation } : {}
                    // ...(toLocation !== undefined) ? { toLocation } : {}
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
            await cinerino.service.payment.paymentCard.voidTransaction({
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

export default paymentCardPaymentRouter;
