/**
 * 通貨転送取引ルーター
 */
import * as cinerino from '@cinerino/domain';

import * as createDebug from 'debug';
import { Router } from 'express';
// tslint:disable-next-line:no-submodule-imports
import { body, query } from 'express-validator/check';
import { NO_CONTENT } from 'http-status';
import * as mongoose from 'mongoose';

import authentication from '../../middlewares/authentication';
import lockTransaction from '../../middlewares/lockTransaction';
import permitScopes from '../../middlewares/permitScopes';
import rateLimit4transactionInProgress from '../../middlewares/rateLimit4transactionInProgress';
import validator from '../../middlewares/validator';

import * as redis from '../../../redis';

const MULTI_TENANT_SUPPORTED = process.env.MULTI_TENANT_SUPPORTED === '1';

// const WAITER_DISABLED = process.env.WAITER_DISABLED === '1';
const moneyTransferTransactionsRouter = Router();
const debug = createDebug('cinerino-api:router');
const pecorinoAuthClient = new cinerino.pecorinoapi.auth.ClientCredentials({
    domain: <string>process.env.PECORINO_AUTHORIZE_SERVER_DOMAIN,
    clientId: <string>process.env.PECORINO_CLIENT_ID,
    clientSecret: <string>process.env.PECORINO_CLIENT_SECRET,
    scopes: [],
    state: ''
});

moneyTransferTransactionsRouter.use(authentication);

moneyTransferTransactionsRouter.post(
    '/start',
    permitScopes(['admin', 'customer', 'transactions']),
    ...[
        body('expires', 'invalid expires')
            .not()
            .isEmpty()
            .isISO8601()
            .toDate(),
        body('object')
            .not()
            .isEmpty(),
        body('agent.identifier')
            .optional()
            .isArray({ max: 10 }),
        body('agent.identifier.*.name')
            .optional()
            .not()
            .isEmpty()
            .isString(),
        body('agent.identifier.*.value')
            .optional()
            .not()
            .isEmpty()
            .isString(),
        body('recipient')
            .not()
            .isEmpty()
            .withMessage((_, __) => 'required'),
        body('recipient.typeOf')
            .not()
            .isEmpty()
            .withMessage((_, __) => 'required')
            .isString(),
        body('seller')
            .not()
            .isEmpty()
            .withMessage((_, __) => 'required'),
        body('seller.typeOf')
            .not()
            .isEmpty()
            .withMessage((_, __) => 'required')
            .isString(),
        body('seller.id')
            .not()
            .isEmpty()
            .withMessage((_, __) => 'required')
            .isString()
        // if (!WAITER_DISABLED) {
        // }
    ],
    validator,
    // tslint:disable-next-line:max-func-body-length
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

            const accountService = new cinerino.pecorinoapi.service.Account({
                endpoint: project.settings.pecorino.endpoint,
                auth: pecorinoAuthClient
            });
            const sellerRepo = new cinerino.repository.Seller(mongoose.connection);
            const transactionRepo = new cinerino.repository.Transaction(mongoose.connection);

            const transaction = await cinerino.service.transaction.moneyTransfer.start({
                project: req.project,
                expires: req.body.expires,
                agent: {
                    ...req.agent,
                    ...(req.body.agent !== undefined && req.body.agent.name !== undefined) ? { name: req.body.agent.name } : {},
                    identifier: [
                        ...(req.agent.identifier !== undefined) ? req.agent.identifier : [],
                        ...(req.body.agent !== undefined && Array.isArray(req.body.agent.identifier))
                            ? (<any[]>req.body.agent.identifier).map((p: any) => {
                                return { name: String(p.name), value: String(p.value) };
                            })
                            : []
                    ]
                },
                object: {
                    clientUser: req.user,
                    // amount: Number(req.body.object.amount),
                    // toLocation: req.body.object.toLocation,
                    authorizeActions: [],
                    ...(typeof req.body.object.description === 'string') ? { description: req.body.object.description } : {}
                },
                recipient: {
                    typeOf: req.body.recipient.typeOf,
                    id: req.body.recipient.id,
                    ...(typeof req.body.recipient.name === 'string') ? { name: req.body.recipient.name } : {},
                    ...(typeof req.body.recipient.url === 'string') ? { url: req.body.recipient.url } : {}
                },
                seller: req.body.seller
            })({
                accountService: accountService,
                seller: sellerRepo,
                transaction: transactionRepo
            });

            // tslint:disable-next-line:no-string-literal
            // const host = req.headers['host'];
            // res.setHeader('Location', `https://${host}/transactions/${transaction.id}`);
            res.json(transaction);
        } catch (error) {
            next(error);
        }
    }
);

moneyTransferTransactionsRouter.put(
    '/:transactionId/confirm',
    permitScopes(['admin', 'customer', 'transactions']),
    validator,
    async (req, res, next) => {
        await rateLimit4transactionInProgress({
            typeOf: cinerino.factory.transactionType.MoneyTransfer,
            id: req.params.transactionId
        })(req, res, next);
    },
    async (req, res, next) => {
        await lockTransaction({
            typeOf: cinerino.factory.transactionType.MoneyTransfer,
            id: req.params.transactionId
        })(req, res, next);
    },
    async (req, res, next) => {
        try {
            const actionRepo = new cinerino.repository.Action(mongoose.connection);
            const transactionRepo = new cinerino.repository.Transaction(mongoose.connection);
            const taskRepo = new cinerino.repository.Task(mongoose.connection);

            await cinerino.service.transaction.moneyTransfer.confirm({
                id: req.params.transactionId
            })({
                action: actionRepo,
                transaction: transactionRepo
            });
            debug('transaction confirmed');

            // 非同期でタスクエクスポート(APIレスポンスタイムに影響を与えないように)
            // tslint:disable-next-line:no-floating-promises
            cinerino.service.transaction.moneyTransfer.exportTasks({
                project: (MULTI_TENANT_SUPPORTED) ? req.project : undefined,
                status: cinerino.factory.transactionStatusType.Confirmed
            })({
                task: taskRepo,
                transaction: transactionRepo
            })
                .then(async (tasks) => {
                    // タスクがあればすべて実行
                    if (Array.isArray(tasks)) {
                        await Promise.all(tasks.map(async (task) => {
                            await cinerino.service.task.executeByName(task)({
                                connection: mongoose.connection,
                                redisClient: redis.getClient()
                            });
                        }));
                    }
                });

            res.status(NO_CONTENT)
                .end();
        } catch (error) {
            next(error);
        }
    }
);

/**
 * 取引を明示的に中止
 */
moneyTransferTransactionsRouter.put(
    '/:transactionId/cancel',
    permitScopes(['admin', 'customer', 'transactions']),
    validator,
    async (req, res, next) => {
        await rateLimit4transactionInProgress({
            typeOf: cinerino.factory.transactionType.MoneyTransfer,
            id: req.params.transactionId
        })(req, res, next);
    },
    async (req, res, next) => {
        await lockTransaction({
            typeOf: cinerino.factory.transactionType.MoneyTransfer,
            id: req.params.transactionId
        })(req, res, next);
    },
    async (req, res, next) => {
        try {
            const taskRepo = new cinerino.repository.Task(mongoose.connection);
            const transactionRepo = new cinerino.repository.Transaction(mongoose.connection);

            await transactionRepo.cancel({
                typeOf: cinerino.factory.transactionType.MoneyTransfer,
                id: req.params.transactionId
            });

            // 非同期でタスクエクスポート(APIレスポンスタイムに影響を与えないように)
            // tslint:disable-next-line:no-floating-promises
            cinerino.service.transaction.moneyTransfer.exportTasks({
                project: (MULTI_TENANT_SUPPORTED) ? req.project : undefined,
                status: cinerino.factory.transactionStatusType.Canceled
            })({
                task: taskRepo,
                transaction: transactionRepo
            });

            res.status(NO_CONTENT)
                .end();
        } catch (error) {
            next(error);
        }
    }
);

/**
 * 取引検索
 */
moneyTransferTransactionsRouter.get(
    '',
    permitScopes(['admin']),
    ...[
        query('startFrom')
            .optional()
            .isISO8601()
            .toDate(),
        query('startThrough')
            .optional()
            .isISO8601()
            .toDate(),
        query('endFrom')
            .optional()
            .isISO8601()
            .toDate(),
        query('endThrough')
            .optional()
            .isISO8601()
            .toDate()
    ],
    validator,
    async (req, res, next) => {
        try {
            const transactionRepo = new cinerino.repository.Transaction(mongoose.connection);
            const searchConditions: any = {
                ...req.query,
                project: (MULTI_TENANT_SUPPORTED) ? { ids: [req.project.id] } : undefined,
                // tslint:disable-next-line:no-magic-numbers
                limit: (req.query.limit !== undefined) ? Math.min(req.query.limit, 100) : 100,
                page: (req.query.page !== undefined) ? Math.max(req.query.page, 1) : 1,
                typeOf: cinerino.factory.transactionType.MoneyTransfer
            };
            const transactions = await transactionRepo.search(searchConditions);
            const totalCount = await transactionRepo.count(searchConditions);
            res.set('X-Total-Count', totalCount.toString());
            res.json(transactions);
        } catch (error) {
            next(error);
        }
    }
);

/**
 * 取引に対するアクション検索
 */
moneyTransferTransactionsRouter.get(
    '/:transactionId/actions',
    permitScopes(['admin']),
    validator,
    async (req, res, next) => {
        try {
            const actionRepo = new cinerino.repository.Action(mongoose.connection);
            const actions = await actionRepo.searchByPurpose({
                purpose: {
                    typeOf: cinerino.factory.transactionType.MoneyTransfer,
                    id: req.params.transactionId
                },
                sort: req.query.sort
            });
            res.json(actions);
        } catch (error) {
            next(error);
        }
    }
);

export default moneyTransferTransactionsRouter;
