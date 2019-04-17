/**
 * IAMルーター
 */
import * as cinerino from '@cinerino/domain';
import * as express from 'express';
// import { OK } from 'http-status';

import authentication from '../middlewares/authentication';
import permitScopes from '../middlewares/permitScopes';
import validator from '../middlewares/validator';

const USER_POOL_ID = <string>process.env.ADMIN_USER_POOL_ID;

const cognitoIdentityServiceProvider = new cinerino.AWS.CognitoIdentityServiceProvider({
    apiVersion: 'latest',
    region: 'ap-northeast-1',
    credentials: new cinerino.AWS.Credentials({
        accessKeyId: <string>process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: <string>process.env.AWS_SECRET_ACCESS_KEY
    })
});

const iamRouter = express.Router();
iamRouter.use(authentication);

/**
 * IAMグループ検索
 */
iamRouter.get(
    '/groups',
    permitScopes(['admin']),
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
    permitScopes(['admin']),
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
    permitScopes(['admin']),
    validator,
    async (req, res, next) => {
        try {
            const personRepo = new cinerino.repository.Person(cognitoIdentityServiceProvider);
            const users = await personRepo.search({
                userPooId: USER_POOL_ID,
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
    permitScopes(['admin']),
    validator,
    async (req, res, next) => {
        try {
            const personRepo = new cinerino.repository.Person(cognitoIdentityServiceProvider);
            const user = await personRepo.findById({
                userPooId: USER_POOL_ID,
                userId: req.params.id
            });

            res.json(user);
        } catch (error) {
            next(error);
        }
    }
);

export default iamRouter;
