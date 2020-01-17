/**
 * 自分の口座ルーター
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';
// tslint:disable-next-line:no-implicit-dependencies
import { ParamsDictionary } from 'express-serve-static-core';
import { body } from 'express-validator';
import { CREATED, NO_CONTENT } from 'http-status';
import * as mongoose from 'mongoose';

import permitScopes from '../../../../middlewares/permitScopes';
import rateLimit from '../../../../middlewares/rateLimit';
import validator from '../../../../middlewares/validator';

import * as redis from '../../../../../redis';

const accountsRouter = Router();

/**
 * 口座開設
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
            .withMessage((_, __) => 'required')
    ],
    validator,
    async (req, res, next) => {
        try {
            const accountNumberRepo = new cinerino.repository.AccountNumber(redis.getClient());
            const ownershipInfoRepo = new cinerino.repository.OwnershipInfo(mongoose.connection);
            const projectRepo = new cinerino.repository.Project(mongoose.connection);

            const ownershipInfo = await cinerino.service.account.open({
                project: req.project,
                agent: req.agent,
                name: req.body.name,
                accountType: <cinerino.factory.accountType>req.params.accountType
            })({
                accountNumber: accountNumberRepo,
                ownershipInfo: ownershipInfoRepo,
                project: projectRepo
            });

            res.status(CREATED)
                .json(ownershipInfo);
        } catch (error) {
            next(error);
        }
    }
);
/**
 * 口座解約
 * 口座の状態を変更するだけで、所有口座リストから削除はしない
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
                ownedBy: {
                    id: req.user.sub
                },
                accountType: <cinerino.factory.accountType>req.params.accountType,
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
    validator,
    async (req, res, next) => {
        try {
            const ownershipInfoRepo = new cinerino.repository.OwnershipInfo(mongoose.connection);
            const projectRepo = new cinerino.repository.Project(mongoose.connection);

            const actions = await cinerino.service.account.searchMoneyTransferActions({
                project: req.project,
                ownedBy: {
                    id: req.user.sub
                },
                conditions: req.query
            })({
                ownershipInfo: ownershipInfoRepo,
                project: projectRepo
            });

            res.set('X-Total-Count', actions.length.toString())
                .json(actions);
        } catch (error) {
            next(error);
        }
    }
);
export default accountsRouter;
