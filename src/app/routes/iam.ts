/**
 * IAMルーター
 */
import * as cinerino from '@cinerino/domain';
import * as express from 'express';
// import { OK } from 'http-status';
import * as mongoose from 'mongoose';

import authentication from '../middlewares/authentication';
import permitScopes from '../middlewares/permitScopes';
import validator from '../middlewares/validator';

const iamRouter = express.Router();
iamRouter.use(authentication);

/**
 * IAMグループ検索
 */
iamRouter.get(
    '/groups',
    permitScopes([]),
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

export default iamRouter;
