/**
 * 口座ルーター
 */
import * as cinerino from '@cinerino/domain';
import * as middlewares from '@motionpicture/express-middleware';
import { Router } from 'express';
import { body } from 'express-validator';
import { CREATED, NO_CONTENT } from 'http-status';
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

const accountsRouter = Router();

/**
 * 管理者として口座開設
 */
accountsRouter.post(
    '',
    permitScopes(['accounts.*', 'accounts.write']),
    ...[
        body('accountType', 'invalid accountType')
            .not()
            .isEmpty(),
        body('name', 'invalid name')
            .not()
            .isEmpty()
    ],
    rateLimit,
    validator,
    async (req, res, next) => {
        try {
            const account = await cinerino.service.account.openWithoutOwnershipInfo({
                project: req.project,
                accountType: req.body.accountType,
                name: req.body.name
            })({
                // accountNumber: new cinerino.repository.AccountNumber(redis.getClient()),
                project: new cinerino.repository.Project(mongoose.connection)
            });

            res.status(CREATED)
                .json(account);
        } catch (error) {
            next(error);
        }
    }
);

/**
 * 管理者として口座解約
 */
// accountsRouter.put(
//     '/:accountType/:accountNumber/close',
//     permitScopes(['accounts.*', 'accounts.write']),
//     rateLimit,
//     validator,
//     async (req, res, next) => {
//         try {
//             await cinerino.service.account.close({
//                 project: req.project,
//                 accountType: <cinerino.factory.accountType>req.params.accountType,
//                 accountNumber: req.params.accountNumber
//             })({
//                 ownershipInfo: new cinerino.repository.OwnershipInfo(mongoose.connection),
//                 project: new cinerino.repository.Project(mongoose.connection)
//             });

//             res.status(NO_CONTENT)
//                 .end();
//         } catch (error) {
//             next(error);
//         }
//     }
// );

// tslint:disable-next-line:no-magic-numbers
const UNIT_IN_SECONDS = 1;

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
            const projectRepo = new cinerino.repository.Project(mongoose.connection);

            const fromLocation: cinerino.chevre.factory.transaction.moneyTransfer.IFromLocation = {
                typeOf: cinerino.factory.personType.Person,
                name: (req.user.username !== undefined) ? req.user.username : req.user.sub,
                ...req.body.agent,
                id: req.user.sub
            };

            const toLocation: cinerino.chevre.factory.transaction.moneyTransfer.IToLocation = {
                typeOf: cinerino.factory.chevre.paymentMethodType.Account,
                // accountType: (typeof req.body.object?.toLocation?.accountType === 'string')
                //     ? req.body.object?.toLocation?.accountType
                //     : 'Point',
                // accountNumber: req.body.object?.toLocation?.accountNumber
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
