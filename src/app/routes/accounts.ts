/**
 * 口座ルーター
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';
// tslint:disable-next-line:no-submodule-imports
import { body } from 'express-validator/check';
import { CREATED, NO_CONTENT } from 'http-status';
import * as mongoose from 'mongoose';

import * as redis from '../../redis';

import authentication from '../middlewares/authentication';
import permitScopes from '../middlewares/permitScopes';
import validator from '../middlewares/validator';

const accountsRouter = Router();

accountsRouter.use(authentication);

/**
 * 管理者として口座開設
 */
accountsRouter.post(
    '',
    permitScopes(['admin']),
    ...[
        body('accountType', 'invalid accountType')
            .not()
            .isEmpty(),
        body('name', 'invalid name')
            .not()
            .isEmpty()
    ],
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
    permitScopes(['admin']),
    validator,
    async (req, res, next) => {
        try {
            await cinerino.service.account.close({
                project: req.project,
                accountType: req.params.accountType,
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
 * 管理者として口座に入金する
 */
accountsRouter.post(
    '/transactions/deposit',
    permitScopes(['admin']),
    ...[
        body('recipient', 'invalid recipient')
            .not()
            .isEmpty(),
        body('amount', 'invalid name')
            .not()
            .isEmpty()
            .isInt(),
        body('toAccountNumber', 'invalid toAccountNumber')
            .not()
            .isEmpty()
    ],
    validator,
    async (req, res, next) => {
        try {
            const projectRepo = new cinerino.repository.Project(mongoose.connection);

            await cinerino.service.account.deposit({
                project: req.project,
                toAccountNumber: req.body.toAccountNumber,
                agent: {
                    id: req.user.sub,
                    name: (req.user.username !== undefined) ? req.user.username : req.user.sub,
                    url: ''
                },
                recipient: req.body.recipient,
                amount: Number(req.body.amount),
                notes: (req.body.notes !== undefined) ? req.body.notes : '入金'
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
