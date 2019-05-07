/**
 * 自分のプロフィールルーター
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';
import { NO_CONTENT } from 'http-status';

import permitScopes from '../../../middlewares/permitScopes';
import validator from '../../../middlewares/validator';

const cognitoIdentityServiceProvider = new cinerino.AWS.CognitoIdentityServiceProvider({
    apiVersion: 'latest',
    region: 'ap-northeast-1',
    credentials: new cinerino.AWS.Credentials({
        accessKeyId: <string>process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: <string>process.env.AWS_SECRET_ACCESS_KEY
    })
});

const profileRouter = Router();

/**
 * プロフィール検索
 */
profileRouter.get(
    '',
    permitScopes(['customer']),
    async (req, res, next) => {
        try {
            const personRepo = new cinerino.repository.Person(cognitoIdentityServiceProvider);
            const profile = await personRepo.getUserAttributesByAccessToken(req.accessToken);
            res.json(profile);
        } catch (error) {
            next(error);
        }
    }
);

/**
 * プロフィール更新
 * @deprecated Use patch method
 */
profileRouter.put(
    '',
    permitScopes(['customer']),
    validator,
    async (req, res, next) => {
        try {
            const personRepo = new cinerino.repository.Person(cognitoIdentityServiceProvider);
            await personRepo.updateProfileByAccessToken({
                accessToken: req.accessToken,
                profile: req.body
            });
            res.status(NO_CONTENT)
                .end();
        } catch (error) {
            next(error);
        }
    }
);

/**
 * プロフィール更新
 */
profileRouter.patch(
    '',
    permitScopes(['customer']),
    validator,
    async (req, res, next) => {
        try {
            const personRepo = new cinerino.repository.Person(cognitoIdentityServiceProvider);
            await personRepo.updateProfileByAccessToken({
                accessToken: req.accessToken,
                profile: req.body
            });
            res.status(NO_CONTENT)
                .end();
        } catch (error) {
            next(error);
        }
    }
);

export default profileRouter;
