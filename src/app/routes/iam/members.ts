/**
 * プロジェクトメンバールーター
 */
import * as cinerino from '@cinerino/domain';
import * as express from 'express';

import permitScopes from '../../middlewares/permitScopes';
import rateLimit from '../../middlewares/rateLimit';
import validator from '../../middlewares/validator';

const iamMembersRouter = express.Router();

// iamMembersRouter.use('/me', iamMeRouter);

/**
 * プロジェクトメンバー検索
 */
iamMembersRouter.get(
    '',
    permitScopes(['iam.members.read']),
    rateLimit,
    validator,
    async (req, res, next) => {
        try {
            const iamService = new cinerino.chevre.service.IAM({
                endpoint: cinerino.credentials.chevre.endpoint,
                auth: req.chevreAuthClient,
                project: { id: req.project.id }
            });

            const { data } = await iamService.searchMembers({
                ...req.query,
                project: { id: { $eq: req.project.id } }
            });

            res.json(data);
        } catch (error) {
            next(error);
        }
    }
);

export default iamMembersRouter;
