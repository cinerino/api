/**
 * 自分の口座ルーター
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';
// tslint:disable-next-line:no-implicit-dependencies
import { ParamsDictionary } from 'express-serve-static-core';
import { body, query } from 'express-validator';
import { CREATED, NO_CONTENT } from 'http-status';
import * as mongoose from 'mongoose';

import permitScopes from '../../../../middlewares/permitScopes';
import rateLimit from '../../../../middlewares/rateLimit';
import validator from '../../../../middlewares/validator';

import * as redis from '../../../../../redis';

const chevreAuthClient = new cinerino.chevre.auth.ClientCredentials({
    domain: <string>process.env.CHEVRE_AUTHORIZE_SERVER_DOMAIN,
    clientId: <string>process.env.CHEVRE_CLIENT_ID,
    clientSecret: <string>process.env.CHEVRE_CLIENT_SECRET,
    scopes: [],
    state: ''
});

const accountsRouter = Router();

/**
 * 口座開設
 * @deprecated 注文取引サービスを使用すべし
 */
// tslint:disable-next-line:use-default-type-parameter
accountsRouter.post<ParamsDictionary>(
    '/:accountType',
    permitScopes(['people.me.*']),
    rateLimit,
    ...[
        body('name')
            .not()
            .isEmpty()
            .withMessage(() => 'required')
    ],
    validator,
    async (req, res, next) => {
        try {
            const actionRepo = new cinerino.repository.Action(mongoose.connection);
            const projectRepo = new cinerino.repository.Project(mongoose.connection);
            const registerActionInProgressRepo = new cinerino.repository.action.RegisterServiceInProgress(redis.getClient());
            const taskRepo = new cinerino.repository.Task(mongoose.connection);
            const transactionRepo = new cinerino.repository.Transaction(mongoose.connection);
            const confirmationNumberRepo = new cinerino.repository.ConfirmationNumber(redis.getClient());
            const orderNumberRepo = new cinerino.repository.OrderNumber(redis.getClient());

            const project = await projectRepo.findById({ id: req.project.id });
            if (typeof project.settings?.cognito?.customerUserPool?.id !== 'string') {
                throw new cinerino.factory.errors.ServiceUnavailable('Project settings not satidfied');
            }
            const personRepo = new cinerino.repository.Person({
                userPoolId: project.settings.cognito.customerUserPool.id
            });

            const ownershipInfoService = new cinerino.chevre.service.OwnershipInfo({
                endpoint: cinerino.credentials.chevre.endpoint,
                auth: chevreAuthClient,
                project: { id: req.project.id }
            });
            const productService = new cinerino.chevre.service.Product({
                endpoint: cinerino.credentials.chevre.endpoint,
                auth: req.chevreAuthClient,
                project: { id: req.project.id }
            });

            const result = await cinerino.service.transaction.orderAccount.orderAccount({
                project: { typeOf: project.typeOf, id: project.id },
                agent: { typeOf: req.agent.typeOf, id: req.agent.id },
                name: req.body.name,
                accountType: req.params.accountType,
                location: { id: req.user.client_id }
            })({
                action: actionRepo,
                categoryCode: new cinerino.chevre.service.CategoryCode({
                    endpoint: cinerino.credentials.chevre.endpoint,
                    auth: req.chevreAuthClient,
                    project: { id: req.project.id }
                }),
                confirmationNumber: confirmationNumberRepo,
                orderNumber: orderNumberRepo,
                ownershipInfo: ownershipInfoService,
                person: personRepo,
                product: productService,
                registerActionInProgress: registerActionInProgressRepo,
                project: projectRepo,
                seller: new cinerino.chevre.service.Seller({
                    endpoint: cinerino.credentials.chevre.endpoint,
                    auth: req.chevreAuthClient,
                    project: { id: req.project.id }
                }),
                transaction: transactionRepo
            });

            // 非同期でタスクエクスポート(APIレスポンスタイムに影響を与えないように)
            // tslint:disable-next-line:no-floating-promises
            cinerino.service.transaction.exportTasks({
                project: req.project,
                status: cinerino.factory.transactionStatusType.Confirmed,
                typeOf: { $in: [cinerino.factory.transactionType.PlaceOrder] }
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

            res.status(CREATED)
                .json(result);
        } catch (error) {
            next(error);
        }
    }
);

/**
 * 口座解約
 * 口座の状態を変更するだけで、所有権は変更しない
 */
accountsRouter.put(
    '/:accountType/:accountNumber/close',
    permitScopes(['people.me.*']),
    rateLimit,
    validator,
    async (req, res, next) => {
        try {
            const accountService = new cinerino.chevre.service.Account({
                endpoint: cinerino.credentials.chevre.endpoint,
                auth: chevreAuthClient,
                project: { id: req.project.id }
            });
            const ownershipInfoService = new cinerino.chevre.service.OwnershipInfo({
                endpoint: cinerino.credentials.chevre.endpoint,
                auth: chevreAuthClient,
                project: { id: req.project.id }
            });

            await cinerino.service.account.close({
                project: req.project,
                ownedBy: { id: req.user.sub },
                accountNumber: req.params.accountNumber
            })({
                account: accountService,
                ownershipInfo: ownershipInfoService
            });

            res.status(NO_CONTENT)
                .end();
        } catch (error) {
            next(error);
        }
    }
);

/**
 * 口座取引履歴検索
 */
accountsRouter.get(
    '/actions/moneyTransfer',
    permitScopes(['people.me.*']),
    rateLimit,
    ...[
        query('accountNumber')
            .not()
            .isEmpty()
            .withMessage(() => 'required')
            .isString()
    ],
    validator,
    async (req, res, next) => {
        try {
            const accountService = new cinerino.chevre.service.Account({
                endpoint: cinerino.credentials.chevre.endpoint,
                auth: chevreAuthClient,
                project: { id: req.project.id }
            });
            const ownershipInfoService = new cinerino.chevre.service.OwnershipInfo({
                endpoint: cinerino.credentials.chevre.endpoint,
                auth: chevreAuthClient,
                project: { id: req.project.id }
            });

            let actions = await cinerino.service.account.searchMoneyTransferActions({
                project: req.project,
                ownedBy: { id: req.user.sub },
                conditions: req.query,
                typeOfGood: { accountNumber: String(req.query.accountNumber) }
            })({
                account: accountService,
                ownershipInfo: ownershipInfoService
            });

            actions = actions.map((a) => {
                return {
                    ...a,
                    amount: (typeof a.amount === 'number')
                        ? {
                            typeOf: 'MonetaryAmount',
                            currency: 'Point', // 旧データはPointしかないのでこれで十分
                            value: a.amount
                        }
                        : a.amount
                };
            });

            res.json(actions);
        } catch (error) {
            next(error);
        }
    }
);

export default accountsRouter;
