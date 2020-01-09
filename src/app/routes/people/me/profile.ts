/**
 * 自分のプロフィールルーター
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';
import { NO_CONTENT } from 'http-status';

import permitScopes from '../../../middlewares/permitScopes';
import rateLimit from '../../../middlewares/rateLimit';
import validator from '../../../middlewares/validator';

import { Permission } from '../../../iam';

const profileRouter = Router();

/**
 * プロフィール検索
 */
profileRouter.get(
    '',
    permitScopes([Permission.User, 'customer']),
    rateLimit,
    async (req, res, next) => {
        try {
            const personRepo = new cinerino.repository.Person({
                userPoolId: '' // アクセストークンに情報が含まれるので必要なし
            });
            const profile = await personRepo.getUserAttributesByAccessToken(req.accessToken);
            res.json(profile);
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
    permitScopes([Permission.User, 'customer']),
    rateLimit,
    validator,
    async (req, res, next) => {
        try {
            const personRepo = new cinerino.repository.Person({
                userPoolId: '' // アクセストークンに情報が含まれるので必要なし
            });
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
