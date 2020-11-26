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
            const ownershipInfoRepo = new cinerino.repository.OwnershipInfo(mongoose.connection);
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

            const result = await cinerino.service.transaction.orderAccount.orderAccount({
                project: { typeOf: project.typeOf, id: project.id },
                agent: { typeOf: req.agent.typeOf, id: req.agent.id },
                name: req.body.name,
                accountType: req.params.accountType,
                location: { id: req.user.client_id }
            })({
                action: actionRepo,
                confirmationNumber: confirmationNumberRepo,
                orderNumber: orderNumberRepo,
                ownershipInfo: ownershipInfoRepo,
                person: personRepo,
                registerActionInProgress: registerActionInProgressRepo,
                project: projectRepo,
                transaction: transactionRepo
            });

            // 非同期でタスクエクスポート(APIレスポンスタイムに影響を与えないように)
            // tslint:disable-next-line:no-floating-promises
            cinerino.service.transaction.exportTasks({
                project: req.project,
                status: cinerino.factory.transactionStatusType.Confirmed,
                typeOf: { $in: [cinerino.factory.transactionType.PlaceOrder] }
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
            const ownershipInfoRepo = new cinerino.repository.OwnershipInfo(mongoose.connection);
            const projectRepo = new cinerino.repository.Project(mongoose.connection);

            await cinerino.service.account.close({
                project: req.project,
                ownedBy: { id: req.user.sub },
                accountNumber: req.params.accountNumber
            })({
                ownershipInfo: ownershipInfoRepo,
                project: projectRepo
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
            const ownershipInfoRepo = new cinerino.repository.OwnershipInfo(mongoose.connection);
            const projectRepo = new cinerino.repository.Project(mongoose.connection);

            let actions = await cinerino.service.account.searchMoneyTransferActions({
                project: req.project,
                ownedBy: { id: req.user.sub },
                conditions: req.query,
                typeOfGood: { accountNumber: String(req.query.accountNumber) }
            })({
                ownershipInfo: ownershipInfoRepo,
                project: projectRepo
            });

            // 互換性維持対応
            // if (USE_MONEY_TRANFER_AMOUNT_AS_NUMBER) {
            //     actions = actions.map((a) => {
            //         return {
            //             ...a,
            //             amount: (typeof a.amount === 'number') ? a.amount : Number(a.amount?.value)
            //         };
            //     });
            // } else {
            // }
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
