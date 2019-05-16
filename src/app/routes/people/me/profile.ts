/**
 * 自分のプロフィールルーター
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';
import { NO_CONTENT } from 'http-status';

import permitScopes from '../../../middlewares/permitScopes';
import validator from '../../../middlewares/validator';

const profileRouter = Router();

/**
 * プロフィール検索
 */
profileRouter.get(
    '',
    permitScopes(['customer']),
    async (req, res, next) => {
        try {
            const personRepo = new cinerino.repository.Person();
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
            const personRepo = new cinerino.repository.Person();
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
            const personRepo = new cinerino.repository.Person();
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
