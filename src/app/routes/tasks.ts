/**
 * タスクルーター
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';
// tslint:disable-next-line:no-submodule-imports
import { body, query } from 'express-validator/check';
import { CREATED } from 'http-status';
import * as moment from 'moment';
import * as mongoose from 'mongoose';

import authentication from '../middlewares/authentication';
import permitScopes from '../middlewares/permitScopes';
import validator from '../middlewares/validator';

const MULTI_TENANT_SUPPORTED = process.env.MULTI_TENANT_SUPPORTED === '1';

const tasksRouter = Router();
tasksRouter.use(authentication);

/**
 * タスク作成
 */
tasksRouter.post(
    '/:name',
    permitScopes(['admin']),
    ...[
        body('runsAt')
            .not()
            .isEmpty()
            .withMessage((_, __) => 'required')
            .isISO8601(),
        body('remainingNumberOfTries')
            .not()
            .isEmpty()
            .withMessage((_, __) => 'required')
            .isInt(),
        body('data')
            .not()
            .isEmpty()
            .withMessage((_, __) => 'required')
    ],
    validator,
    async (req, res, next) => {
        try {
            const attributes: cinerino.factory.task.IAttributes<cinerino.factory.taskName> = {
                name: <cinerino.factory.taskName>req.params.name,
                status: cinerino.factory.taskStatus.Ready,
                runsAt: moment(req.body.runsAt)
                    .toDate(),
                remainingNumberOfTries: Number(req.body.remainingNumberOfTries),
                numberOfTried: 0,
                executionResults: [],
                data: req.body.data,
                project: req.project
            };

            const taskRepo = new cinerino.repository.Task(mongoose.connection);
            const task = await taskRepo.save(attributes);

            res.status(CREATED)
                .json(task);
        } catch (error) {
            next(error);
        }
    }
);

/**
 * タスク確認
 */
tasksRouter.get(
    '/:name/:id',
    permitScopes(['admin']),
    validator,
    async (req, res, next) => {
        try {
            const taskRepo = new cinerino.repository.Task(mongoose.connection);
            const task = await taskRepo.findById({
                name: <cinerino.factory.taskName>req.params.name,
                id: req.params.id
            });
            res.json(task);
        } catch (error) {
            next(error);
        }
    }
);

/**
 * タスク検索
 */
tasksRouter.get(
    '',
    permitScopes(['admin']),
    ...[
        query('runsFrom')
            .optional()
            .isISO8601()
            .withMessage((_, options) => `${options.path} must be ISO8601 timestamp`)
            .toDate(),
        query('runsThrough')
            .optional()
            .isISO8601()
            .withMessage((_, options) => `${options.path} must be ISO8601 timestamp`)
            .toDate(),
        query('lastTriedFrom')
            .optional()
            .isISO8601()
            .withMessage((_, options) => `${options.path} must be ISO8601 timestamp`)
            .toDate(),
        query('lastTriedThrough')
            .optional()
            .isISO8601()
            .withMessage((_, options) => `${options.path} must be ISO8601 timestamp`)
            .toDate()
    ],
    validator,
    async (req, res, next) => {
        try {
            const taskRepo = new cinerino.repository.Task(mongoose.connection);
            const searchConditions: cinerino.factory.task.ISearchConditions<cinerino.factory.taskName> = {
                ...req.query,
                project: (MULTI_TENANT_SUPPORTED) ? { ids: [req.project.id] } : undefined,
                // tslint:disable-next-line:no-magic-numbers
                limit: (req.query.limit !== undefined) ? Math.min(req.query.limit, 100) : 100,
                page: (req.query.page !== undefined) ? Math.max(req.query.page, 1) : 1
            };
            const tasks = await taskRepo.search(searchConditions);
            const totalCount = await taskRepo.count(searchConditions);
            res.set('X-Total-Count', totalCount.toString());
            res.json(tasks);
        } catch (error) {
            next(error);
        }
    }
);

export default tasksRouter;
