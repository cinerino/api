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
import * as mongoose from 'mongoose';

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

const pecorinoAuthClient = new cinerino.pecorinoapi.auth.ClientCredentials({
    domain: cinerino.credentials.pecorino.authorizeServerDomain,
    clientId: cinerino.credentials.pecorino.clientId,
    clientSecret: cinerino.credentials.pecorino.clientSecret,
    scopes: [],
    state: ''
});

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
                auth: chevreAuthClient
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
            let accountNumber: string | undefined;
            let orderNumber: string | undefined;

            // トークン検証
            // tslint:disable-next-line:no-suspicious-comment
            // TODO audienceのチェック
            const payload = await cinerino.service.code.verifyToken<cinerino.factory.order.ISimpleOrder>({
                project: req.project,
                agent: req.agent,
                token: token,
                secret: <string>process.env.TOKEN_SECRET,
                issuer: [<string>process.env.RESOURCE_SERVER_IDENTIFIER]
            })({});

            switch (payload.typeOf) {
                case cinerino.factory.order.OrderType.Order:
                    orderNumber = <string>(<any>payload).orderNumber;

                    // 注文検索
                    const orderRepo = new cinerino.repository.Order(mongoose.connection);
                    const order = await orderRepo.findByOrderNumber({ orderNumber });

                    // 口座番号を取得
                    accountNumber = order.identifier?.find(
                        (i) => i.name === cinerino.service.transaction.placeOrderInProgress.AWARD_ACCOUNT_NUMBER_IDENTIFIER_NAME
                    )?.value;

                    break;

                default:
                    throw new cinerino.factory.errors.NotImplemented(`Payload type ${payload.typeOf} not implemented`);
            }

            if (typeof accountNumber === 'string' && accountNumber.length > 0) {
                // pecorinoで口座開設
                const accountService = new cinerino.pecorinoapi.service.Account({
                    endpoint: cinerino.credentials.pecorino.endpoint,
                    auth: pecorinoAuthClient
                });
                await accountService.open([{
                    project: {
                        typeOf: 'Project',
                        id: req.project.id
                    },
                    typeOf: accountTypeOf,
                    accountType: accountType,
                    accountNumber: accountNumber,
                    name: `Order:${orderNumber}`,
                    ...(typeof initialBalance === 'number') ? { initialBalance } : undefined
                }]);
            }

            res.status(NO_CONTENT)
                .end();
        } catch (error) {
            error = cinerino.errorHandler.handleChevreError(error);
            error = cinerino.errorHandler.handlePecorinoError(error);
            next(error);
        }
    }
);

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
                auth: chevreAuthClient
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

            const projectRepo = new cinerino.repository.Project(mongoose.connection);

            const fromLocation: cinerino.chevre.factory.transaction.moneyTransfer.IFromLocation = {
                typeOf: cinerino.factory.personType.Person,
                name: (req.user.username !== undefined) ? req.user.username : req.user.sub,
                ...req.body.agent,
                id: req.user.sub
            };

            const toLocation: cinerino.chevre.factory.transaction.moneyTransfer.IToLocation = {
                typeOf: String(product.serviceOutput?.typeOf),
                identifier: req.body.object?.toLocation?.accountNumber
            };

            const recipient: cinerino.chevre.factory.transaction.moneyTransfer.IRecipient = {
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
            })({
                project: projectRepo
            });

            res.status(NO_CONTENT)
                .end();
        } catch (error) {
            next(error);
        }
    }
);

export function deposit(params: {
    project: cinerino.factory.project.IProject;
    agent: cinerino.chevre.factory.transaction.moneyTransfer.IAgent;
    object: cinerino.chevre.factory.transaction.moneyTransfer.IObjectWithoutDetail;
    recipient: cinerino.chevre.factory.transaction.moneyTransfer.IRecipient;
}) {
    return async (repos: {
        project: cinerino.repository.Project;
    }) => {
        try {
            const project = await repos.project.findById({ id: params.project.id });

            const transactionNumberService = new cinerino.chevre.service.TransactionNumber({
                endpoint: cinerino.credentials.chevre.endpoint,
                auth: chevreAuthClient
            });
            const { transactionNumber } = await transactionNumberService.publish({
                project: { id: project.id }
            });

            // Chevreで入金
            const moneyTransferService = new cinerino.chevre.service.transaction.MoneyTransfer({
                endpoint: cinerino.credentials.chevre.endpoint,
                auth: chevreAuthClient
            });

            await moneyTransferService.start({
                transactionNumber: transactionNumber,
                project: { typeOf: project.typeOf, id: project.id },
                typeOf: cinerino.chevre.factory.transactionType.MoneyTransfer,
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
                        typeOf: cinerino.factory.pecorino.transactionType.Deposit,
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
