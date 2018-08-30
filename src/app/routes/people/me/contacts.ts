/**
 * 自分の連絡先ルーター
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';
import { NO_CONTENT } from 'http-status';

import permitScopes from '../../../middlewares/permitScopes';
import validator from '../../../middlewares/validator';

const contactsRouter = Router();

const cognitoIdentityServiceProvider = new cinerino.AWS.CognitoIdentityServiceProvider({
    apiVersion: 'latest',
    region: 'ap-northeast-1',
    credentials: new cinerino.AWS.Credentials({
        accessKeyId: <string>process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: <string>process.env.AWS_SECRET_ACCESS_KEY
    })
});

/**
 * 連絡先検索
 */
contactsRouter.get(
    '',
    permitScopes(['aws.cognito.signin.user.admin']),
    async (req, res, next) => {
        try {
            const personRepo = new cinerino.repository.Person(cognitoIdentityServiceProvider);
            const contact = await personRepo.getUserAttributesByAccessToken(req.accessToken);
            res.json(contact);
        } catch (error) {
            next(error);
        }
    }
);

/**
 * 会員プロフィール更新
 */
contactsRouter.put(
    '',
    permitScopes(['aws.cognito.signin.user.admin']),
    (__1, __2, next) => {
        next();
    },
    validator,
    async (req, res, next) => {
        try {
            const personRepo = new cinerino.repository.Person(cognitoIdentityServiceProvider);
            await personRepo.updateContactByAccessToken({
                accessToken: req.accessToken,
                contact: {
                    givenName: req.body.givenName,
                    familyName: req.body.familyName,
                    email: req.body.email,
                    telephone: req.body.telephone
                }
            });
            res.status(NO_CONTENT).end();
        } catch (error) {
            next(error);
        }
    }
);

export default contactsRouter;
