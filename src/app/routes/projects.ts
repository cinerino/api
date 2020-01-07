/**
 * プロジェクトルーター
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';
import * as mongoose from 'mongoose';

import permitScopes from '../middlewares/permitScopes';
import rateLimit from '../middlewares/rateLimit';
import setMemberPermissions from '../middlewares/setMemberPermissions';
import validator from '../middlewares/validator';

import { RoleName } from '../iam';

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
                'member.id': req.user.sub,
                'member.hasRole.roleName': { $in: [RoleName.Owner, RoleName.Editor, RoleName.Viewer] }
            };
            const totalCount = await memberRepo.memberModel.countDocuments(searchCoinditions)
                .setOptions({ maxTimeMS: 10000 })
                .exec();
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
            // const totalCount = await projectRepo.count(searchCoinditions);

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
    (req, _, next) => {
        req.project = { typeOf: cinerino.factory.organizationType.Project, id: req.params.id };

        next();
    },
    setMemberPermissions,
    permitScopes(['projects.*', 'projects.read-only']),
    rateLimit,
    validator,
    async (req, res, next) => {
        try {
            const memberRepo = new cinerino.repository.Member(mongoose.connection);
            const projectRepo = new cinerino.repository.Project(mongoose.connection);

            // 権限を持つプロジェクト検索
            const searchCoinditions = {
                'project.id': req.params.id,
                'member.id': req.user.sub
            };
            const projectMember = await memberRepo.memberModel.findOne(
                searchCoinditions,
                { project: 1 }
            )
                .setOptions({ maxTimeMS: 10000 })
                .exec();
            if (projectMember === null) {
                throw new cinerino.factory.errors.NotFound('Project');
            }

            const project = await projectRepo.findById(
                { id: req.params.id },
                undefined
            );

            res.json(project);
        } catch (error) {
            next(error);
        }
    }
);

export default projectsRouter;
