/**
 * IAMルーター
 */
import * as cinerino from '@cinerino/domain';
import * as express from 'express';
import { NO_CONTENT } from 'http-status';
import * as mongoose from 'mongoose';

import permitScopes from '../middlewares/permitScopes';
import rateLimit from '../middlewares/rateLimit';
import validator from '../middlewares/validator';

const iamRouter = express.Router();

/**
 * IAMグループ検索
 */
iamRouter.get(
    '/groups',
    permitScopes([]),
    rateLimit,
    validator,
    async (_, res, next) => {
        try {
            res.set('X-Total-Count', '0');
            res.json([]);
        } catch (error) {
            next(error);
        }
    }
);

/**
 * IAMロール検索
 */
iamRouter.get(
    '/roles',
    permitScopes([]),
    rateLimit,
    validator,
    async (_, res, next) => {
        try {
            res.set('X-Total-Count', '0');
            res.json([]);
        } catch (error) {
            next(error);
        }
    }
);

/**
 * IAMユーザー検索
 */
iamRouter.get(
    '/users',
    permitScopes([]),
    rateLimit,
    validator,
    async (req, res, next) => {
        try {
            const projectRepo = new cinerino.repository.Project(mongoose.connection);
            const project = await projectRepo.findById({ id: req.project.id });
            if (project.settings === undefined
                || project.settings.cognito === undefined) {
                throw new cinerino.factory.errors.ServiceUnavailable('Project settings undefined');
            }

            const personRepo = new cinerino.repository.Person({
                userPoolId: project.settings.cognito.adminUserPool.id
            });
            const users = await personRepo.search({
                id: req.query.id,
                username: req.query.username,
                email: req.query.email,
                telephone: req.query.telephone,
                givenName: req.query.givenName,
                familyName: req.query.familyName
            });

            res.set('X-Total-Count', users.length.toString());
            res.json(users);
        } catch (error) {
            next(error);
        }
    }
);

/**
 * IDでユーザー検索
 */
iamRouter.get(
    '/users/:id',
    permitScopes([]),
    rateLimit,
    validator,
    async (req, res, next) => {
        try {
            const projectRepo = new cinerino.repository.Project(mongoose.connection);
            const project = await projectRepo.findById({ id: req.project.id });
            if (project.settings === undefined
                || project.settings.cognito === undefined) {
                throw new cinerino.factory.errors.ServiceUnavailable('Project settings undefined');
            }

            const personRepo = new cinerino.repository.Person({
                userPoolId: project.settings.cognito.adminUserPool.id
            });
            const user = await personRepo.findById({
                userId: req.params.id
            });

            res.json(user);
        } catch (error) {
            next(error);
        }
    }
);

/**
 * プロフィール検索
 */
iamRouter.get(
    '/users/:id/profile',
    permitScopes([]),
    rateLimit,
    async (req, res, next) => {
        try {
            const projectRepo = new cinerino.repository.Project(mongoose.connection);
            const project = await projectRepo.findById({ id: req.project.id });
            if (project.settings === undefined
                || project.settings.cognito === undefined) {
                throw new cinerino.factory.errors.ServiceUnavailable('Project settings undefined');
            }

            const personRepo = new cinerino.repository.Person({
                userPoolId: project.settings.cognito.adminUserPool.id
            });
            const person = await personRepo.findById({
                userId: req.params.id
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
 * プロフィール更新
 */
iamRouter.patch(
    '/users/:id/profile',
    permitScopes([]),
    rateLimit,
    validator,
    async (req, res, next) => {
        try {
            const projectRepo = new cinerino.repository.Project(mongoose.connection);
            const project = await projectRepo.findById({ id: req.project.id });
            if (project.settings === undefined
                || project.settings.cognito === undefined) {
                throw new cinerino.factory.errors.ServiceUnavailable('Project settings undefined');
            }

            const personRepo = new cinerino.repository.Person({
                userPoolId: project.settings.cognito.adminUserPool.id
            });
            const person = await personRepo.findById({
                userId: req.params.id
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

export default iamRouter;
