/**
 * プロジェクトルーター
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';
import * as mongoose from 'mongoose';

import permitScopes from '../middlewares/permitScopes';
import rateLimit from '../middlewares/rateLimit';
import validator from '../middlewares/validator';

const RESOURCE_SERVER_IDENTIFIER = <string>process.env.RESOURCE_SERVER_IDENTIFIER;

const projectsRouter = Router();

/**
 * プロジェクト検索
 * 閲覧権限を持つプロジェクトを検索
 */
projectsRouter.get(
    '',
    // permitScopes([]),
    rateLimit,
    validator,
    async (req, res, next) => {
        try {
            const memberRepo = new cinerino.repository.Member(mongoose.connection);
            const projectRepo = new cinerino.repository.Project(mongoose.connection);

            // tslint:disable-next-line:no-magic-numbers
            const limit = (req.query.limit !== undefined) ? Math.min(req.query.limit, 100) : 100;
            const page = (req.query.page !== undefined) ? Math.max(req.query.page, 1) : 1;

            // 権限を持つプロジェクト検索
            const searchCoinditions = {
                'member.id': req.user.sub
            };

            const projectMembers = await memberRepo.memberModel.find(
                searchCoinditions,
                { project: 1 }
            )
                .limit(limit)
                .skip(limit * (page - 1))
                .setOptions({ maxTimeMS: 10000 })
                .exec()
                .then((docs) => docs.map((doc) => doc.toObject()));

            const projects = await projectRepo.search(
                {
                    ids: projectMembers.map((m) => m.project.id),
                    limit: limit
                },
                { settings: 0 }
            );

            res.json(projects);
        } catch (error) {
            next(error);
        }
    }
);

/**
 * プロジェクト取得
 */
projectsRouter.get(
    '/:id',
    permitScopes(['projects.*', 'projects.read']),
    rateLimit,
    validator,
    async (req, res, next) => {
        try {
            const projectRepo = new cinerino.repository.Project(mongoose.connection);

            const projection: any = (req.memberPermissions.indexOf(`${RESOURCE_SERVER_IDENTIFIER}/projects.settings.read`) >= 0)
                ? undefined
                : { settings: 0 };
            const project = await projectRepo.findById({ id: req.project.id }, projection);

            res.json(project);
        } catch (error) {
            next(error);
        }
    }
);

/**
 * プロジェクト設定取得
 */
projectsRouter.get(
    '/:id/settings',
    permitScopes(['projects.*', 'projects.settings.read']),
    rateLimit,
    validator,
    async (req, res, next) => {
        try {
            const projectRepo = new cinerino.repository.Project(mongoose.connection);
            const project = await projectRepo.findById({ id: req.project.id });

            res.json(project.settings);
        } catch (error) {
            next(error);
        }
    }
);

export default projectsRouter;
