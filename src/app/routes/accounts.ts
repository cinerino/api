/**
 * ポイント口座ルーター
 */
import * as cinerino from '@cinerino/domain';
// import * as createDebug from 'debug';
import { Router } from 'express';
import { NO_CONTENT } from 'http-status';
import * as mongoose from 'mongoose';

import authentication from '../middlewares/authentication';
import permitScopes from '../middlewares/permitScopes';
import validator from '../middlewares/validator';

const accountsRouter = Router();

// const debug = createDebug('cinerino-api:routes:accounts');

accountsRouter.use(authentication);

/**
 * 管理者として口座に入金する
 */
accountsRouter.post(
    '/transactions/deposit',
    permitScopes(['admin']),
    (req, __, next) => {
        req.checkBody('recipient', 'invalid recipient')
            .notEmpty()
            .withMessage('recipient is required');
        req.checkBody('amount', 'invalid amount')
            .notEmpty()
            .withMessage('amount is required')
            .isInt();
        req.checkBody('toAccountNumber', 'invalid toAccountNumber')
            .notEmpty()
            .withMessage('toAccountNumber is required');
        next();
    },
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
