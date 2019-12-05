/**
 * 口座ルーター
 */
import * as cinerino from '@cinerino/domain';
import * as middlewares from '@motionpicture/express-middleware';
import { Router } from 'express';
// tslint:disable-next-line:no-submodule-imports
import { body, query } from 'express-validator/check';
import { CREATED, NO_CONTENT } from 'http-status';
import * as ioredis from 'ioredis';
import * as mongoose from 'mongoose';

import * as redis from '../../redis';

import permitScopes from '../middlewares/permitScopes';
import rateLimit from '../middlewares/rateLimit';
import validator from '../middlewares/validator';

const pecorinoAuthClient = new cinerino.pecorinoapi.auth.ClientCredentials({
    domain: <string>process.env.PECORINO_AUTHORIZE_SERVER_DOMAIN,
    clientId: <string>process.env.PECORINO_CLIENT_ID,
    clientSecret: <string>process.env.PECORINO_CLIENT_SECRET,
    scopes: [],
    state: ''
});

const accountsRouter = Router();

/**
 * 管理者として口座開設
 */
accountsRouter.post(
    '',
    permitScopes([]),
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
                accountNumber: new cinerino.repository.AccountNumber(redis.getClient()),
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
accountsRouter.put(
    '/:accountType/:accountNumber/close',
    permitScopes([]),
    rateLimit,
    validator,
    async (req, res, next) => {
        try {
            await cinerino.service.account.close({
                project: req.project,
                accountType: <cinerino.factory.accountType>req.params.accountType,
                accountNumber: req.params.accountNumber
            })({
                ownershipInfo: new cinerino.repository.OwnershipInfo(mongoose.connection),
                project: new cinerino.repository.Project(mongoose.connection)
            });

            res.status(NO_CONTENT)
                .end();
        } catch (error) {
            next(error);
        }
    }
);

/**
 * 口座検索
 */
accountsRouter.get(
    '',
    permitScopes([]),
    rateLimit,
    ...[
        query('accountType', 'invalid accountType')
            .not()
            .isEmpty()
            .withMessage(() => 'required')
        // query('bookingFrom')
        //     .not()
        //     .isEmpty()
        //     .isISO8601()
        //     .toDate(),
        // query('bookingThrough')
        //     .not()
        //     .isEmpty()
        //     .isISO8601()
        //     .toDate()
        //     .custom((value, { req }) => {
        //         // 期間指定を限定
        //         const bookingThrough = moment(value);
        //         if (req.query !== undefined) {
        //             const bookingThroughExpectedToBe = moment(req.query.bookingFrom)
        //                 .add(1, 'months');
        //             if (bookingThrough.isAfter(bookingThroughExpectedToBe)) {
        //                 throw new Error('Booking time range too large');
        //             }
        //         }

        //         return true;
        //     })
    ],
    validator,
    async (req, res, next) => {
        try {
            const projectRepo = new cinerino.repository.Project(mongoose.connection);
            const project = await projectRepo.findById({ id: req.project.id });
            if (project.settings === undefined) {
                throw new cinerino.factory.errors.ServiceUnavailable('Project settings undefined');
            }
            if (project.settings.pecorino === undefined) {
                throw new cinerino.factory.errors.ServiceUnavailable('Project settings not found');
            }

            // クエリをそのままPecorino検索へパス
            const accountService = new cinerino.pecorinoapi.service.Account({
                endpoint: project.settings.pecorino.endpoint,
                auth: pecorinoAuthClient
            });
            const searchResult = await accountService.search({
                ...req.query,
                project: { id: { $eq: req.project.id } }
            });
            res.set('X-Total-Count', searchResult.totalCount.toString());
            res.json(searchResult.data);
        } catch (error) {
            next(error);
        }
    }
);

/**
 * 取引履歴検索
 */
accountsRouter.get(
    '/actions/moneyTransfer',
    permitScopes([]),
    rateLimit,
    ...[
        query('accountType', 'invalid accountType')
            .not()
            .isEmpty()
            .withMessage(() => 'required')
        // query('bookingFrom')
        //     .not()
        //     .isEmpty()
        //     .isISO8601()
        //     .toDate(),
        // query('bookingThrough')
        //     .not()
        //     .isEmpty()
        //     .isISO8601()
        //     .toDate()
        //     .custom((value, { req }) => {
        //         // 期間指定を限定
        //         const bookingThrough = moment(value);
        //         if (req.query !== undefined) {
        //             const bookingThroughExpectedToBe = moment(req.query.bookingFrom)
        //                 .add(1, 'months');
        //             if (bookingThrough.isAfter(bookingThroughExpectedToBe)) {
        //                 throw new Error('Booking time range too large');
        //             }
        //         }

        //         return true;
        //     })
    ],
    validator,
    async (req, res, next) => {
        try {
            const projectRepo = new cinerino.repository.Project(mongoose.connection);
            const project = await projectRepo.findById({ id: req.project.id });
            if (project.settings === undefined) {
                throw new cinerino.factory.errors.ServiceUnavailable('Project settings undefined');
            }
            if (project.settings.pecorino === undefined) {
                throw new cinerino.factory.errors.ServiceUnavailable('Project settings not found');
            }

            // クエリをそのままPecorino検索へパス
            const actionService = new cinerino.pecorinoapi.service.Action({
                endpoint: project.settings.pecorino.endpoint,
                auth: pecorinoAuthClient
            });
            const searchResult = await actionService.searchMoneyTransferActions({
                ...req.query,
                project: { id: { $eq: req.project.id } }
            });
            res.set('X-Total-Count', searchResult.totalCount.toString());
            res.json(searchResult.data);
        } catch (error) {
            next(error);
        }
    }
);

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
    permitScopes([]),
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

            await cinerino.service.account.deposit({
                project: req.project,
                agent: {
                    typeOf: cinerino.factory.personType.Person,
                    name: (req.user.username !== undefined) ? req.user.username : req.user.sub,
                    ...req.body.agent,
                    id: req.user.sub
                },
                object: {
                    ...req.body.object,
                    description: (typeof req.body.object.description === 'string') ? req.body.object.description : '入金'
                },
                recipient: {
                    typeOf: cinerino.factory.personType.Person,
                    ...req.body.recipient
                }
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

export default accountsRouter;
