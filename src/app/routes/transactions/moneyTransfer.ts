/**
 * 通貨転送取引ルーター
 */
import * as cinerino from '@cinerino/domain';

import * as createDebug from 'debug';
import { Request, Router } from 'express';
// tslint:disable-next-line:no-implicit-dependencies
import { ParamsDictionary } from 'express-serve-static-core';
import { body, query } from 'express-validator';
import { NO_CONTENT } from 'http-status';
import * as mongoose from 'mongoose';

import lockTransaction from '../../middlewares/lockTransaction';
import permitScopes from '../../middlewares/permitScopes';
import rateLimit from '../../middlewares/rateLimit';
import rateLimit4transactionInProgress from '../../middlewares/rateLimit4transactionInProgress';
import validator from '../../middlewares/validator';

import * as redis from '../../../redis';

const ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH = (process.env.ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH !== undefined)
    ? Number(process.env.ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH)
    // tslint:disable-next-line:no-magic-numbers
    : 256;

// const WAITER_DISABLED = process.env.WAITER_DISABLED === '1';
const moneyTransferTransactionsRouter = Router();
const debug = createDebug('cinerino-api:router');

// tslint:disable-next-line:use-default-type-parameter
moneyTransferTransactionsRouter.post<ParamsDictionary>(
    '/start',
    permitScopes(['transactions']),
    ...[
        body('expires', 'invalid expires')
            .not()
            .isEmpty()
            .withMessage(() => 'required')
            .isISO8601()
            .toDate(),
        body('object')
            .not()
            .isEmpty()
            .withMessage(() => 'required'),
        body('object.amount')
            .not()
            .isEmpty()
            .withMessage(() => 'required')
            .isInt()
            .toInt(),
        body('object.fromLocation')
            .not()
            .isEmpty(),
        body('object.toLocation')
            .not()
            .isEmpty()
            .withMessage(() => 'required'),
        body('agent.identifier')
            .optional()
            .isArray({ max: 10 }),
        body('agent.identifier.*.name')
            .optional()
            .not()
            .isEmpty()
            .isString()
            .isLength({ max: ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH }),
        body('agent.identifier.*.value')
            .optional()
            .not()
            .isEmpty()
            .isString()
            .isLength({ max: ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH }),
        body('recipient')
            .not()
            .isEmpty()
            .withMessage(() => 'required'),
        body('recipient.typeOf')
            .not()
            .isEmpty()
            .withMessage(() => 'required')
            .isString(),
        body('seller')
            .not()
            .isEmpty()
            .withMessage(() => 'required'),
        body('seller.typeOf')
            .not()
            .isEmpty()
            .withMessage(() => 'required')
            .isString(),
        body('seller.id')
            .not()
            .isEmpty()
            .withMessage(() => 'required')
            .isString()
        // if (!WAITER_DISABLED) {
        // }
    ],
    validator,
    async (req, res, next) => {
        try {
            const projectRepo = new cinerino.repository.Project(mongoose.connection);
            const project = await projectRepo.findById({ id: req.project.id });
            if (project.settings === undefined || project.settings.pecorino === undefined) {
                throw new cinerino.factory.errors.ServiceUnavailable('Project settings not found');
            }

            // const accountService = new cinerino.pecorinoapi.service.Account({
            //     endpoint: project.settings.pecorino.endpoint,
            //     auth: pecorinoAuthClient
            // });
            const actionRepo = new cinerino.repository.Action(mongoose.connection);
            const sellerRepo = new cinerino.repository.Seller(mongoose.connection);
            const transactionRepo = new cinerino.repository.Transaction(mongoose.connection);

            const fromLocation = await validateFromLocation(req);

            const transaction = await cinerino.service.transaction.moneyTransfer.start({
                project: req.project,
                expires: req.body.expires,
                agent: {
                    ...req.agent,
                    ...(req.body.agent !== undefined && req.body.agent.name !== undefined) ? { name: req.body.agent.name } : {},
                    identifier: [
                        ...(Array.isArray(req.agent.identifier)) ? req.agent.identifier : [],
                        ...(req.body.agent !== undefined && Array.isArray(req.body.agent.identifier))
                            ? (<any[]>req.body.agent.identifier).map((p: any) => {
                                return { name: String(p.name), value: String(p.value) };
                            })
                            : []
                    ]
                },
                object: {
                    amount: req.body.object.amount,
                    fromLocation: fromLocation,
                    toLocation: req.body.object.toLocation,
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
                // accountService: accountService,
                action: actionRepo,
                project: projectRepo,
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

async function validateFromLocation(req: Request): Promise<cinerino.factory.transaction.moneyTransfer.IFromLocation> {
    return req.body.object.fromLocation;

    // トークン化された口座情報でリクエストされた場合、実口座情報へ変換する
    // if (typeof fromLocation === 'string') {
    //     // tslint:disable-next-line:max-line-length
    // tslint:disable-next-line:max-line-length
    //     type IPayload = cinerino.factory.ownershipInfo.IOwnershipInfo<cinerino.factory.ownershipInfo.IGood<cinerino.factory.ownershipInfo.AccountGoodType.Account>>;
    //     const accountOwnershipInfo = await cinerino.service.code.verifyToken<IPayload>({
    //         project: req.project,
    //         agent: req.agent,
    //         token: fromLocation,
    //         secret: <string>process.env.TOKEN_SECRET,
    //         issuer: <string>process.env.RESOURCE_SERVER_IDENTIFIER
    //     })({ action: new cinerino.repository.Action(mongoose.connection) });
    //     const account = accountOwnershipInfo.typeOfGood;
    //     // if (account.accountType !== 'Coin') {
    //     //     throw new cinerino.factory.errors.Argument('fromAccount', 'Invalid token');
    //     // }
    //     fromLocation = <any>account;
    // } else {
    //     // 口座情報がトークンでない、かつ、APIユーザーが管理者でない場合、許可されるリクエストかどうか確認
    //     if (!req.isAdmin) {
    //         // 口座に所有権があるかどうか確認
    //         const ownershipInfoRepo = new cinerino.repository.OwnershipInfo(mongoose.connection);
    //         const count = await ownershipInfoRepo.count<cinerino.factory.ownershipInfo.AccountGoodType.Account>({
    //             limit: 1,
    //             ownedBy: { id: req.user.sub },
    //             ownedFrom: new Date(),
    //             ownedThrough: new Date(),
    //             typeOfGood: {
    //                 typeOf: cinerino.factory.ownershipInfo.AccountGoodType.Account,
    //                 accountType: fromLocation.accountType,
    //                 accountNumber: fromLocation.accountNumber
    //             }
    //         });
    //         if (count === 0) {
    //             throw new cinerino.factory.errors.Forbidden('From Account access forbidden');
    //         }
    //     }
    // }

    // return fromLocation;
}

/**
 * 取引人プロフィール変更
 */
// tslint:disable-next-line:use-default-type-parameter
moneyTransferTransactionsRouter.put<ParamsDictionary>(
    '/:transactionId/agent',
    permitScopes(['transactions']),
    ...[
        body('additionalProperty')
            .optional()
            .isArray({ max: 10 }),
        body('additionalProperty.*.name')
            .optional()
            .not()
            .isEmpty()
            .isString()
            .isLength({ max: ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH }),
        body('additionalProperty.*.value')
            .optional()
            .not()
            .isEmpty()
            .isString()
            .isLength({ max: ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH })
    ],
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
            await cinerino.service.transaction.updateAgent({
                typeOf: cinerino.factory.transactionType.MoneyTransfer,
                id: req.params.transactionId,
                agent: {
                    ...req.body,
                    typeOf: cinerino.factory.personType.Person,
                    id: req.user.sub
                }
            })({
                transaction: new cinerino.repository.Transaction(mongoose.connection)
            });

            res.status(NO_CONTENT)
                .end();
        } catch (error) {
            next(error);
        }
    }
);

moneyTransferTransactionsRouter.put(
    '/:transactionId/confirm',
    permitScopes(['transactions']),
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
            const projectRepo = new cinerino.repository.Project(mongoose.connection);
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
            cinerino.service.transaction.exportTasks({
                project: req.project,
                status: cinerino.factory.transactionStatusType.Confirmed,
                typeOf: { $in: [cinerino.factory.transactionType.MoneyTransfer] }
            })({
                project: projectRepo,
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
    permitScopes(['transactions']),
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
            const projectRepo = new cinerino.repository.Project(mongoose.connection);
            const taskRepo = new cinerino.repository.Task(mongoose.connection);
            const transactionRepo = new cinerino.repository.Transaction(mongoose.connection);

            await transactionRepo.cancel({
                typeOf: cinerino.factory.transactionType.MoneyTransfer,
                id: req.params.transactionId
            });

            // 非同期でタスクエクスポート(APIレスポンスタイムに影響を与えないように)
            // tslint:disable-next-line:no-floating-promises
            cinerino.service.transaction.exportTasks({
                project: req.project,
                status: cinerino.factory.transactionStatusType.Canceled,
                typeOf: { $in: [cinerino.factory.transactionType.MoneyTransfer] }
            })({
                project: projectRepo,
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
    permitScopes(['transactions.*', 'transactions.read']),
    rateLimit,
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
                project: { id: { $eq: req.project.id } },
                // tslint:disable-next-line:no-magic-numbers
                limit: (req.query.limit !== undefined) ? Math.min(req.query.limit, 100) : 100,
                page: (req.query.page !== undefined) ? Math.max(req.query.page, 1) : 1,
                typeOf: cinerino.factory.transactionType.MoneyTransfer
            };
            const transactions = await transactionRepo.search(searchConditions);

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
    permitScopes(['transactions.*', 'transactions.read']),
    rateLimit,
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
