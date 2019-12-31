/**
 * プロジェクトルーター
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';
import * as mongoose from 'mongoose';

import permitScopes from '../middlewares/permitScopes';
import rateLimit from '../middlewares/rateLimit';
import validator from '../middlewares/validator';

const projectsRouter = Router();

/**
 * プロジェクト検索
 * 閲覧権限を持つプロジェクトを検索可能
 */
projectsRouter.get(
    '',
    permitScopes([]),
    rateLimit,
    validator,
    async (req, res, next) => {
        try {
            // ownerロールを持つプロジェクト検索
            const memberRepo = new cinerino.repository.Member(mongoose.connection);
            const projectMembers = await memberRepo.memberModel.find(
                {
                    'member.id': req.user.sub,
                    'member.hasRole.roleName': 'owner'
                },
                { project: 1 }
            )
                .exec();

            const searchCoinditions: cinerino.factory.project.ISearchConditions = {
                ...req.query,
                ids: projectMembers.map((m) => m.project.id),
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

export default projectsRouter;
