/**
 * プロジェクトメンバールーター
 */
import * as cinerino from '@cinerino/domain';
import * as express from 'express';
import { NO_CONTENT } from 'http-status';
import * as mongoose from 'mongoose';

import permitScopes from '../../middlewares/permitScopes';
import rateLimit from '../../middlewares/rateLimit';
import validator from '../../middlewares/validator';

import iamMeRouter from './members/me';

const iamMembersRouter = express.Router();

iamMembersRouter.use('/me', iamMeRouter);

/**
 * プロジェクトメンバー検索
 */
iamMembersRouter.get(
    '',
    permitScopes([]),
    rateLimit,
    validator,
    async (req, res, next) => {
        try {
            const searchCoinditions: any = {
                ...req.query,
                project: { id: { $eq: req.project.id } },
                // tslint:disable-next-line:no-magic-numbers
                limit: (req.query.limit !== undefined) ? Math.min(req.query.limit, 100) : 100,
                page: (req.query.page !== undefined) ? Math.max(req.query.page, 1) : 1
            };

            const memberRepo = new cinerino.repository.Member(mongoose.connection);
            const members = await memberRepo.search(searchCoinditions);
            const totalCount = await memberRepo.count(searchCoinditions);

            res.set('X-Total-Count', totalCount.toString());
            res.json(members);
        } catch (error) {
            next(error);
        }
    }
);

/**
 * プロジェクトメンバー取得
 */
iamMembersRouter.get(
    '/:id',
    permitScopes([]),
    rateLimit,
    validator,
    async (req, res, next) => {
        try {
            const memberRepo = new cinerino.repository.Member(mongoose.connection);
            const members = await memberRepo.search({
                member: { id: { $eq: req.params.id } },
                project: { id: { $eq: req.project.id } },
                limit: 1
            });
            if (members.length === 0) {
                throw new cinerino.factory.errors.NotFound('Member');
            }

            res.json(members[0].member);
        } catch (error) {
            next(error);
        }
    }
);

/**
 * プロジェクトメンバープロフィール取得
 */
iamMembersRouter.get(
    '/:id/profile',
    permitScopes([]),
    rateLimit,
    async (req, res, next) => {
        try {
            const memberRepo = new cinerino.repository.Member(mongoose.connection);
            const projectRepo = new cinerino.repository.Project(mongoose.connection);

            const project = await projectRepo.findById({ id: req.project.id });
            if (project.settings === undefined
                || project.settings.cognito === undefined) {
                throw new cinerino.factory.errors.ServiceUnavailable('Project settings undefined');
            }

            const members = await memberRepo.search({
                member: { id: { $eq: req.params.id } },
                project: { id: { $eq: req.project.id } },
                limit: 1
            });
            if (members.length === 0) {
                throw new cinerino.factory.errors.NotFound('Member');
            }

            const member = members[0].member;

            const personRepo = new cinerino.repository.Person({
                userPoolId: project.settings.cognito.adminUserPool.id
            });
            const person = await personRepo.findById({
                userId: member.id
            });

            if (person.memberOf === undefined) {
                throw new cinerino.factory.errors.NotFound('Person.memberOf');
            }

            const username = person.memberOf.membershipNumber;
            if (username === undefined) {
                throw new cinerino.factory.errors.NotFound('Person.memberOf.membershipNumber');
            }

            const profile = await personRepo.getUserAttributes({
                username: username
            });

            res.json(profile);
        } catch (error) {
            next(error);
        }
    }
);

/**
 * プロジェクトメンバープロフィール更新
 */
iamMembersRouter.patch(
    '/:id/profile',
    permitScopes([]),
    rateLimit,
    validator,
    async (req, res, next) => {
        try {
            const memberRepo = new cinerino.repository.Member(mongoose.connection);
            const projectRepo = new cinerino.repository.Project(mongoose.connection);

            const project = await projectRepo.findById({ id: req.project.id });
            if (project.settings === undefined
                || project.settings.cognito === undefined) {
                throw new cinerino.factory.errors.ServiceUnavailable('Project settings undefined');
            }

            const members = await memberRepo.search({
                member: { id: { $eq: req.params.id } },
                project: { id: { $eq: req.project.id } },
                limit: 1
            });
            if (members.length === 0) {
                throw new cinerino.factory.errors.NotFound('Member');
            }

            const member = members[0].member;

            const personRepo = new cinerino.repository.Person({
                userPoolId: project.settings.cognito.adminUserPool.id
            });
            const person = await personRepo.findById({
                userId: member.id
            });

            if (person.memberOf === undefined) {
                throw new cinerino.factory.errors.NotFound('Person.memberOf');
            }

            const username = person.memberOf.membershipNumber;
            if (username === undefined) {
                throw new cinerino.factory.errors.NotFound('Person.memberOf.membershipNumber');
            }

            await personRepo.updateProfile({
                username: username,
                profile: req.body
            });

            res.status(NO_CONTENT)
                .end();
        } catch (error) {
            next(error);
        }
    }
);

export default iamMembersRouter;
