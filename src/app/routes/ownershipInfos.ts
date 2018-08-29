/**
 * 認証ルーター
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';

import authentication from '../middlewares/authentication';
// import permitScopes from '../middlewares/permitScopes';
import validator from '../middlewares/validator';

import * as redis from '../../redis';

const ownershipInfosRouter = Router();
ownershipInfosRouter.use(authentication);
/**
 * コードから所有権に対するアクセストークンを発行する
 */
ownershipInfosRouter.post(
    '/tokens',
    // permitScopes(['aws.cognito.signin.user.admin']),
    validator,
    async (req, res, next) => {
        try {
            const codeRepo = new cinerino.repository.Code(redis.getClient());
            const token = await cinerino.service.code.getToken({
                code: req.body.code,
                secret: <string>process.env.TOKEN_SECRET,
                issuer: <string>process.env.RESOURCE_SERVER_IDENTIFIER,
                // tslint:disable-next-line:no-magic-numbers
                expiresIn: 1800
            })({
                code: codeRepo
            });
            res.json({ token });
        } catch (error) {
            next(error);
        }
    }
);
ownershipInfosRouter.get(
    '/:goodType/:identifier/actions/checkToken',
    // permitScopes(['aws.cognito.signin.user.admin']),
    validator,
    async (_, res, next) => {
        try {
            const actions: any[] = [];
            res.json(actions);
        } catch (error) {
            next(error);
        }
    }
);
export default ownershipInfosRouter;
