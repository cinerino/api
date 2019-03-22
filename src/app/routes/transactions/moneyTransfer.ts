/**
 * 通貨転送取引ルーター
 */
import * as cinerino from '@cinerino/domain';

import * as createDebug from 'debug';
import { Router } from 'express';
// tslint:disable-next-line:no-submodule-imports
import { query } from 'express-validator/check';
import { NO_CONTENT } from 'http-status';
import * as moment from 'moment';
import * as mongoose from 'mongoose';

import authentication from '../../middlewares/authentication';
import permitScopes from '../../middlewares/permitScopes';
import rateLimit4transactionInProgress from '../../middlewares/rateLimit4transactionInProgress';
import validator from '../../middlewares/validator';

const WAITER_DISABLED = process.env.WAITER_DISABLED === '1';
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
    permitScopes(['admin', 'aws.cognito.signin.user.admin', 'transactions']),
    (req, _, next) => {
        req.checkBody('expires', 'invalid expires')
            .notEmpty()
            .withMessage('expires is required')
            .isISO8601();
        req.checkBody('agent.identifier', 'invalid agent identifier')
            .optional()
            .isArray();
        req.checkBody('recipient.typeOf', 'invalid recipient type')
            .notEmpty()
            .withMessage('recipient.typeOf is required');
        req.checkBody('seller.typeOf', 'invalid seller type')
            .notEmpty()
            .withMessage('seller.typeOf is required');
        req.checkBody('seller.id', 'invalid seller id')
            .notEmpty()
            .withMessage('seller.id is required');
        if (!WAITER_DISABLED) {
            //     req.checkBody('object.passport.token', 'invalid passport token')
            //         .notEmpty()
            //         .withMessage('object.passport.token is required');
        }

        next();
    },
    validator,
    // tslint:disable-next-line:max-func-body-length
    async (req, res, next) => {
        try {
            const accountService = new cinerino.pecorinoapi.service.Account({
                endpoint: <string>process.env.PECORINO_ENDPOINT,
                auth: pecorinoAuthClient
            });
            const sellerRepo = new cinerino.repository.Seller(mongoose.connection);
            const transactionRepo = new cinerino.repository.Transaction(mongoose.connection);

            const expires = moment(<string>req.body.expires)
                .toDate();

            const transaction = await cinerino.service.transaction.moneyTransfer.start({
                expires: expires,
                agent: {
                    ...req.agent,
                    identifier: [
                        ...(req.agent.identifier !== undefined) ? req.agent.identifier : [],
                        ...(req.body.agent !== undefined && req.body.agent.identifier !== undefined) ? req.body.agent.identifier : []
                    ]
                },
                object: {
                    clientUser: req.user,
                    amount: Number(req.body.object.amount),
                    toLocation: req.body.object.toLocation,
                    authorizeActions: [],
                    description: req.body.object.description
                },
                recipient: {
                    typeOf: req.body.recipient.typeOf,
                    id: req.body.recipient.id,
                    name: req.body.recipient.name,
                    url: req.body.recipient.url
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
    permitScopes(['admin', 'aws.cognito.signin.user.admin', 'transactions']),
    validator,
    async (req, res, next) => {
        await rateLimit4transactionInProgress({
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
                id: <string>req.params.transactionId
            })({
                action: actionRepo,
                transaction: transactionRepo
            });
            debug('transaction confirmed');

            // 非同期でタスクエクスポート(APIレスポンスタイムに影響を与えないように)
            // tslint:disable-next-line:no-floating-promises
            cinerino.service.transaction.moneyTransfer.exportTasks(cinerino.factory.transactionStatusType.Confirmed)({
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
 * 取引を明示的に中止
 */
moneyTransferTransactionsRouter.put(
    '/:transactionId/cancel',
    permitScopes(['admin', 'aws.cognito.signin.user.admin', 'transactions']),
    validator,
    async (req, res, next) => {
        try {
            const taskRepo = new cinerino.repository.Task(mongoose.connection);
            const transactionRepo = new cinerino.repository.Transaction(mongoose.connection);

            await transactionRepo.cancel({
                typeOf: cinerino.factory.transactionType.MoneyTransfer,
                id: <string>req.params.transactionId
            });

            // 非同期でタスクエクスポート(APIレスポンスタイムに影響を与えないように)
            // tslint:disable-next-line:no-floating-promises
            cinerino.service.transaction.moneyTransfer.exportTasks(cinerino.factory.transactionStatusType.Canceled)({
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
                    id: <string>req.params.transactionId
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
