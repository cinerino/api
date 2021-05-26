/**
 * 口座ルーター
 */
import * as cinerino from '@cinerino/domain';
import * as middlewares from '@motionpicture/express-middleware';
import { Router } from 'express';
import { body } from 'express-validator';
import { NO_CONTENT } from 'http-status';
import * as ioredis from 'ioredis';
import * as moment from 'moment';

// import * as redis from '../../redis';

import permitScopes from '../middlewares/permitScopes';
import rateLimit from '../middlewares/rateLimit';
import validator from '../middlewares/validator';

const chevreAuthClient = new cinerino.chevre.auth.ClientCredentials({
    domain: <string>process.env.CHEVRE_AUTHORIZE_SERVER_DOMAIN,
    clientId: <string>process.env.CHEVRE_CLIENT_ID,
    clientSecret: <string>process.env.CHEVRE_CLIENT_SECRET,
    scopes: [],
    state: ''
});

// const pecorinoAuthClient = new cinerino.pecorinoapi.auth.ClientCredentials({
//     domain: cinerino.credentials.pecorino.authorizeServerDomain,
//     clientId: cinerino.credentials.pecorino.clientId,
//     clientSecret: cinerino.credentials.pecorino.clientSecret,
//     scopes: [],
//     state: ''
// });

const accountsRouter = Router();

/**
 * トークンで口座開設
 */
accountsRouter.post(
    '/openByToken',
    permitScopes(['accounts.openByToken']),
    rateLimit,
    ...[
        body('instrument.token')
            .not()
            .isEmpty()
            .isString(),
        body('object.typeOf')
            .not()
            .isEmpty()
            .isString(),
        body('object.initialBalance')
            .not()
            .isEmpty()
            .isInt()
            .toInt()
    ],
    validator,
    async (req, res, next) => {
        try {
            const token = <string>req.body.instrument?.token;
            const accountTypeOf = req.body.object?.typeOf;
            const initialBalance = req.body.object?.initialBalance;

            // プロダクト検索
            const productService = new cinerino.chevre.service.Product({
                endpoint: cinerino.credentials.chevre.endpoint,
                auth: req.chevreAuthClient,
                project: { id: req.project.id }
            });
            const searchProductsResult = await productService.search({
                limit: 1,
                project: { id: { $eq: req.project.id } },
                typeOf: { $eq: cinerino.factory.chevre.product.ProductType.PaymentCard },
                serviceOutput: { typeOf: { $eq: accountTypeOf } }
            });
            const product = searchProductsResult.data.shift();
            if (product === undefined) {
                throw new cinerino.factory.errors.NotFound('Product');
            }

            const accountType = (<any>product).serviceOutput?.amount?.currency;
            let awardAccounts: cinerino.service.transaction.placeOrderInProgress.IAwardAccount[] = [];
            let orderNumber: string | undefined;

            // トークン検証
            const hubClientId = cinerino.credentials.hub.clientId;
            if (typeof hubClientId !== 'string' || hubClientId.length === 0) {
                throw new cinerino.factory.errors.NotFound('hub client');
            }
            const payload = await cinerino.service.code.verifyToken<cinerino.factory.order.ISimpleOrder>({
                project: req.project,
                agent: req.agent,
                token: token,
                secret: <string>process.env.TOKEN_SECRET,
                issuer: [<string>process.env.RESOURCE_SERVER_IDENTIFIER],
                // audienceのチェック
                audience: [hubClientId]
            })({});

            switch (payload.typeOf) {
                case cinerino.factory.order.OrderType.Order:
                    orderNumber = <string>(<any>payload).orderNumber;

                    // 注文検索
                    const orderService = new cinerino.chevre.service.Order({
                        endpoint: cinerino.credentials.chevre.endpoint,
                        auth: chevreAuthClient,
                        project: { id: req.project.id }
                    });
                    const order = await orderService.findByOrderNumber({ orderNumber });

                    // 口座番号を取得
                    const awardAccountsValue = order.identifier?.find(
                        (i) => i.name === cinerino.service.transaction.placeOrderInProgress.AWARD_ACCOUNTS_IDENTIFIER_NAME
                    )?.value;
                    if (typeof awardAccountsValue === 'string' && awardAccountsValue.length > 0) {
                        awardAccounts = JSON.parse(awardAccountsValue);
                    }

                    break;

                default:
                    throw new cinerino.factory.errors.NotImplemented(`Payload type ${payload.typeOf} not implemented`);
            }

            // 指定された口座種別の特典口座が存在すれば、開設
            const awardAccount = awardAccounts.find((a) => a.typeOf === accountTypeOf);
            if (awardAccount !== undefined) {
                await openAccountIfNotExist({
                    project: { typeOf: 'Project', id: req.project.id },
                    typeOf: accountTypeOf,
                    accountType: accountType,
                    accountNumber: awardAccount.accountNumber,
                    name: `Order:${orderNumber}`,
                    ...(typeof initialBalance === 'number') ? { initialBalance } : undefined
                });
            }

            res.status(NO_CONTENT)
                .end();
        } catch (error) {
            error = cinerino.errorHandler.handleChevreError(error);
            next(error);
        }
    }
);

async function openAccountIfNotExist(params: {
    project: { typeOf: 'Project'; id: string };
    typeOf: string;
    accountType: string;
    accountNumber: string;
    name: string;
    initialBalance?: number;
}) {
    // chevreで実装
    const accountService = new cinerino.chevre.service.Account({
        endpoint: cinerino.credentials.chevre.endpoint,
        auth: chevreAuthClient,
        project: { id: params.project.id }
    });
    // const accountService = new cinerino.pecorinoapi.service.Account({
    //     endpoint: cinerino.credentials.pecorino.endpoint,
    //     auth: pecorinoAuthClient
    // });

    try {
        // pecorinoで口座開設
        await accountService.open([params]);
    } catch (error) {
        // 口座番号重複エラーの可能性もあるので、口座が既存であればok
        const searchAcconutsResult = await accountService.search({
            limit: 1,
            project: { id: { $eq: params.project.id } },
            accountNumber: { $eq: params.accountNumber }
        });
        if (searchAcconutsResult.data.length < 1) {
            throw error;
        }
    }
}

// tslint:disable-next-line:no-magic-numbers
const UNIT_IN_SECONDS = 5;

// tslint:disable-next-line:no-magic-numbers
const THRESHOLD = 1;

const redisClient = new ioredis({
    host: <string>process.env.REDIS_HOST,
    port: Number(<string>process.env.REDIS_PORT),
    password: <string>process.env.REDIS_KEY,
    tls: (process.env.REDIS_TLS_SERVERNAME !== undefined) ? { servername: process.env.REDIS_TLS_SERVERNAME } : undefined
});

const depositAccountRateLimiet = middlewares.rateLimit({
    redisClient: redisClient,
    aggregationUnitInSeconds: UNIT_IN_SECONDS,
    threshold: THRESHOLD,
    // 制限超過時の動作をカスタマイズ
    limitExceededHandler: (_, __, res, next) => {
        res.setHeader('Retry-After', UNIT_IN_SECONDS);
        const message = `Retry after ${UNIT_IN_SECONDS} seconds for your transaction`;
        next(new cinerino.factory.errors.RateLimitExceeded(message));
    },
    // スコープ生成ロジックをカスタマイズ
    scopeGenerator: (_) => 'api:rateLimit4accountDepositTransaction'
});

/**
 * 管理者として口座に入金する
 */
accountsRouter.post(
    '/transactions/deposit',
    permitScopes(['accounts.transactions.deposit.write']),
    // 互換性維持のため
    (req, _, next) => {
        if (req.body.object === undefined || req.body.object === null) {
            req.body.object = {};
        }
        if (typeof req.body.amount === 'number') {
            req.body.object.amount = Number(req.body.amount);
        }
        if (typeof req.body.notes === 'string') {
            req.body.object.description = req.body.notes;
        }
        if (typeof req.body.toAccountNumber === 'string') {
            if (req.body.object.toLocation === undefined || req.body.object.toLocation === null) {
                req.body.object.toLocation = {};
            }
            req.body.object.toLocation.accountNumber = req.body.toAccountNumber;
        }

        next();
    },
    ...[
        body('recipient')
            .not()
            .isEmpty()
            .withMessage(() => 'required'),
        body('object.amount')
            .not()
            .isEmpty()
            .withMessage(() => 'required')
            .isInt()
            .withMessage(() => 'Amount must be number')
            .custom((value) => {
                if (Number(value) <= 0) {
                    throw new Error('Amount must be more than 0');
                }

                return true;
            })
            .withMessage(() => 'Amount must be more than 0'),
        body('object.toLocation.accountNumber')
            .not()
            .isEmpty()
            .withMessage(() => 'required')
    ],
    validator,
    depositAccountRateLimiet,
    async (req, res, next) => {
        try {
            // ひとつ目のペイメントカードプロダクトを検索
            const productService = new cinerino.chevre.service.Product({
                endpoint: cinerino.credentials.chevre.endpoint,
                auth: req.chevreAuthClient,
                project: { id: req.project.id }
            });
            const searchProductsResult = await productService.search({
                limit: 1,
                project: { id: { $eq: req.project.id } },
                typeOf: { $eq: cinerino.factory.chevre.product.ProductType.PaymentCard }
            });
            const product = searchProductsResult.data.shift();
            if (product === undefined) {
                throw new cinerino.factory.errors.NotFound('Product');
            }

            const fromLocation: cinerino.chevre.factory.assetTransaction.moneyTransfer.IFromLocation = {
                typeOf: cinerino.factory.personType.Person,
                name: (req.user.username !== undefined) ? req.user.username : req.user.sub,
                ...req.body.agent,
                id: req.user.sub
            };

            const toLocation: cinerino.chevre.factory.assetTransaction.moneyTransfer.IToLocation = {
                typeOf: String(product.serviceOutput?.typeOf),
                identifier: req.body.object?.toLocation?.accountNumber
            };

            const recipient: cinerino.chevre.factory.assetTransaction.moneyTransfer.IRecipient = {
                typeOf: cinerino.factory.personType.Person,
                ...req.body.recipient
            };

            const amount: number = Number(req.body.object?.amount);
            const description: string = (typeof req.body.object?.description === 'string') ? req.body.object.description : '入金';

            await deposit({
                project: req.project,
                agent: fromLocation,
                object: {
                    amount: {
                        typeOf: 'MonetaryAmount',
                        currency: '', // 使用されないので空文字でok
                        value: amount
                    },
                    fromLocation: fromLocation,
                    toLocation: toLocation,
                    description: description
                },
                recipient: recipient
            })({});

            res.status(NO_CONTENT)
                .end();
        } catch (error) {
            next(error);
        }
    }
);

export function deposit(params: {
    project: cinerino.factory.project.IProject;
    agent: cinerino.chevre.factory.assetTransaction.moneyTransfer.IAgent;
    object: cinerino.chevre.factory.assetTransaction.moneyTransfer.IObjectWithoutDetail;
    recipient: cinerino.chevre.factory.assetTransaction.moneyTransfer.IRecipient;
}) {
    return async (__: {}) => {
        try {
            const transactionNumberService = new cinerino.chevre.service.TransactionNumber({
                endpoint: cinerino.credentials.chevre.endpoint,
                auth: chevreAuthClient,
                project: { id: params.project.id }
            });
            const { transactionNumber } = await transactionNumberService.publish({
                project: { id: params.project.id }
            });

            // Chevreで入金
            const moneyTransferService = new cinerino.chevre.service.assetTransaction.MoneyTransfer({
                endpoint: cinerino.credentials.chevre.endpoint,
                auth: chevreAuthClient,
                project: { id: params.project.id }
            });

            await moneyTransferService.start({
                transactionNumber: transactionNumber,
                project: { typeOf: cinerino.factory.chevre.organizationType.Project, id: params.project.id },
                typeOf: cinerino.chevre.factory.assetTransactionType.MoneyTransfer,
                agent: params.agent,
                expires: moment()
                    .add(1, 'minutes')
                    .toDate(),
                object: {
                    amount: params.object.amount,
                    fromLocation: params.object.fromLocation,
                    toLocation: params.object.toLocation,
                    description: params.object.description,
                    pendingTransaction: {
                        typeOf: cinerino.factory.account.transactionType.Deposit,
                        id: '' // 空でok
                    }
                },
                recipient: params.recipient
            });

            await moneyTransferService.confirm({ transactionNumber: transactionNumber });
        } catch (error) {
            error = cinerino.errorHandler.handleChevreError(error);
            throw error;
        }
    };
}

export default accountsRouter;
