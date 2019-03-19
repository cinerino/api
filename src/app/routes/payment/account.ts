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
import validator from '../../middlewares/validator';

const pecorinoAuthClient = new cinerino.pecorinoapi.auth.ClientCredentials({
    domain: <string>process.env.PECORINO_AUTHORIZE_SERVER_DOMAIN,
    clientId: <string>process.env.PECORINO_CLIENT_ID,
    clientSecret: <string>process.env.PECORINO_CLIENT_SECRET,
    scopes: [],
    state: ''
});

const accountPaymentRouter = Router();
accountPaymentRouter.use(authentication);

/**
 * 口座確保
 */
accountPaymentRouter.post(
    '/authorize',
    permitScopes(['admin', 'aws.cognito.signin.user.admin', 'transactions']),
    ...[
        body('object.amount')
            .not()
            .isEmpty()
            .withMessage((_, options) => `${options.path} is required`)
            .isInt(),
        body('object.additionalProperty')
            .optional()
            .isArray(),
        body('object.fromAccount')
            .not()
            .isEmpty()
            .withMessage((_, options) => `${options.path} is required`)
    ],
    validator,
    // rateLimit4transactionInProgress,
    async (req, res, next) => {
        try {
            let fromAccount: cinerino.factory.action.authorize.paymentMethod.account.IFromAccount<cinerino.factory.accountType>
                = req.body.object.fromAccount;

            // トークン化された口座情報でリクエストされた場合、実口座情報へ変換する
            if (typeof fromAccount === 'string') {
                // tslint:disable-next-line:max-line-length
                type IPayload = cinerino.factory.ownershipInfo.IOwnershipInfo<cinerino.factory.ownershipInfo.IGood<cinerino.factory.ownershipInfo.AccountGoodType.Account>>;
                const accountOwnershipInfo = await cinerino.service.code.verifyToken<IPayload>({
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

            const toAccount = req.body.object.toAccount;

            // pecorino転送取引サービスクライアントを生成
            const transferService = new cinerino.pecorinoapi.service.transaction.Transfer({
                endpoint: <string>process.env.PECORINO_ENDPOINT,
                auth: pecorinoAuthClient
            });
            const withdrawService = new cinerino.pecorinoapi.service.transaction.Withdraw({
                endpoint: <string>process.env.PECORINO_ENDPOINT,
                auth: pecorinoAuthClient
            });

            const action = await cinerino.service.payment.account.authorize({
                object: {
                    typeOf: cinerino.factory.paymentMethodType.Account,
                    amount: req.body.object.amount,
                    additionalProperty: req.body.object.additionalProperty,
                    fromAccount: {
                        accountType: fromAccount.accountType,
                        accountNumber: fromAccount.accountNumber
                    },
                    toAccount: {
                        accountType: toAccount.accountType,
                        accountNumber: toAccount.accountNumber
                    },
                    notes: req.body.object.notes
                },
                agent: { id: req.user.sub },
                purpose: { typeOf: req.body.purpose.typeOf, id: <string>req.body.purpose.id }
            })({
                action: new cinerino.repository.Action(mongoose.connection),
                transaction: new cinerino.repository.Transaction(mongoose.connection),
                transferTransactionService: transferService,
                withdrawTransactionService: withdrawService
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
    permitScopes(['admin', 'aws.cognito.signin.user.admin', 'transactions']),
    validator,
    // rateLimit4transactionInProgress,
    async (req, res, next) => {
        try {
            const withdrawService = new cinerino.pecorinoapi.service.transaction.Withdraw({
                endpoint: <string>process.env.PECORINO_ENDPOINT,
                auth: pecorinoAuthClient
            });
            const transferService = new cinerino.pecorinoapi.service.transaction.Transfer({
                endpoint: <string>process.env.PECORINO_ENDPOINT,
                auth: pecorinoAuthClient
            });

            await cinerino.service.payment.account.voidTransaction({
                id: <string>req.params.actionId,
                agent: { id: req.user.sub },
                purpose: { typeOf: req.body.purpose.typeOf, id: <string>req.body.purpose.id }
            })({
                action: new cinerino.repository.Action(mongoose.connection),
                transaction: new cinerino.repository.Transaction(mongoose.connection),
                transferTransactionService: transferService,
                withdrawTransactionService: withdrawService
            });

            res.status(NO_CONTENT)
                .end();
        } catch (error) {
            next(error);
        }
    }
);

export default accountPaymentRouter;
