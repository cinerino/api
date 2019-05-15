/**
 * 口座決済ルーター
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';
// tslint:disable-next-line:no-submodule-imports
import { body } from 'express-validator/check';
import { CREATED, NO_CONTENT } from 'http-status';
import * as mongoose from 'mongoose';

import authentication from '../../middlewares/authentication';
import permitScopes from '../../middlewares/permitScopes';
import rateLimit4transactionInProgress from '../../middlewares/rateLimit4transactionInProgress';
import validator from '../../middlewares/validator';

const accountPaymentRouter = Router();
accountPaymentRouter.use(authentication);

/**
 * 口座確保
 */
accountPaymentRouter.post(
    '/authorize',
    permitScopes(['admin', 'customer', 'transactions']),
    ...[
        body('object.amount')
            .not()
            .isEmpty()
            .withMessage((_, __) => 'required')
            .isInt(),
        body('object.additionalProperty')
            .optional()
            .isArray(),
        body('object.fromAccount')
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
    // tslint:disable-next-line:max-func-body-length
    async (req, res, next) => {
        try {
            let fromAccount: cinerino.factory.action.authorize.paymentMethod.account.IFromAccount<cinerino.factory.accountType>
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
                // 口座情報がトークンでない、かつ、APIユーザーが管理者でない場合、口座に所有権があるかどうか確認
                if (!req.isAdmin) {
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

            const accountType = fromAccount.accountType;

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
                    additionalProperty: req.body.object.additionalProperty,
                    fromAccount: fromAccount,
                    toAccount: toAccount,
                    notes: req.body.object.notes
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
    permitScopes(['admin', 'customer', 'transactions']),
    validator,
    async (req, res, next) => {
        await rateLimit4transactionInProgress({
            typeOf: req.body.purpose.typeOf,
            id: <string>req.body.purpose.id
        })(req, res, next);
    },
    async (req, res, next) => {
        try {
            await cinerino.service.payment.account.voidTransaction({
                project: req.project,
                id: <string>req.params.actionId,
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
