/**
 * タスクルーター
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';
// tslint:disable-next-line:no-submodule-imports
import { body } from 'express-validator/check';
import { CREATED } from 'http-status';
import * as moment from 'moment';

import authentication from '../middlewares/authentication';
import permitScopes from '../middlewares/permitScopes';
import validator from '../middlewares/validator';

const tasksRouter = Router();
tasksRouter.use(authentication);
/**
 * タスク作成
 */
tasksRouter.post(
    '/:name',
    permitScopes(['admin']),
    ...[
        body('runsAt').not().isEmpty().withMessage((_, options) => `${options.path} is required`)
            .isISO8601(),
        body('remainingNumberOfTries').not().isEmpty().withMessage((_, options) => `${options.path} is required`)
            .isInt(),
        body('data').not().isEmpty().withMessage((_, options) => `${options.path} is required`)
    ],
    validator,
    async (req, res, next) => {
        try {
            const taskRepo = new cinerino.repository.Task(cinerino.mongoose.connection);
            const attributes: cinerino.factory.task.IAttributes<cinerino.factory.taskName> = {
                name: req.params.name,
                status: cinerino.factory.taskStatus.Ready,
                runsAt: moment(req.body.runsAt).toDate(),
                remainingNumberOfTries: Number(req.body.remainingNumberOfTries),
                lastTriedAt: null,
                numberOfTried: 0,
                executionResults: [],
                data: req.body.data
            };
            const task = await taskRepo.save(attributes);
            res.status(CREATED).json(task);
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
            const taskRepo = new cinerino.repository.Task(cinerino.mongoose.connection);
            const task = await taskRepo.findById({
                name: req.params.name,
                id: req.params.id
            });
            res.json(task);
        } catch (error) {
            next(error);
        }
    }
);
export default tasksRouter;
