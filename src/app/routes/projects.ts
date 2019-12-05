/**
 * プロジェクトルーター
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';
import * as mongoose from 'mongoose';

import permitScopes from '../middlewares/permitScopes';
import rateLimit from '../middlewares/rateLimit';
import validator from '../middlewares/validator';

import projectDetailRouter from './projects/detail';

const projectsRouter = Router();

/**
 * プロジェクト検索
 */
projectsRouter.get(
    '',
    permitScopes([]),
    rateLimit,
    validator,
    async (req, res, next) => {
        try {
            const searchCoinditions: cinerino.factory.project.ISearchConditions = {
                ...req.query,
                // tslint:disable-next-line:no-magic-numbers
                limit: (req.query.limit !== undefined) ? Math.min(req.query.limit, 100) : 100,
                page: (req.query.page !== undefined) ? Math.max(req.query.page, 1) : 1
            };

            const projectRepo = new cinerino.repository.Project(mongoose.connection);
            const projects = await projectRepo.search(
                searchCoinditions,
                undefined
            );
            const totalCount = await projectRepo.count(searchCoinditions);

            res.set('X-Total-Count', totalCount.toString());
            res.json(projects);
        } catch (error) {
            next(error);
        }
    }
);

/**
 * IDでプロジェクト検索
 */
projectsRouter.get(
    '/:id',
    permitScopes([]),
    rateLimit,
    validator,
    async (req, res, next) => {
        try {
            const projectRepo = new cinerino.repository.Project(mongoose.connection);

            const seller = await projectRepo.findById(
                { id: req.params.id },
                undefined
            );

            res.json(seller);
        } catch (error) {
            next(error);
        }
    }
);

projectsRouter.all(
    '/:id/*',
    async (req, _, next) => {
        // プロジェクト指定ルーティング配下については、すべてreq.projectを上書き
        req.project = { typeOf: 'Project', id: req.params.id };

        next();
    }
);

projectsRouter.use('/:id', projectDetailRouter);

export default projectsRouter;
