/**
 * IAMメンバー(me)ルーター
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';
import * as mongoose from 'mongoose';

import permitScopes from '../../../middlewares/permitScopes';
import rateLimit from '../../../middlewares/rateLimit';
import validator from '../../../middlewares/validator';

const iamMeRouter = Router();

iamMeRouter.get(
    '',
    permitScopes(['iam.members.me.read']),
    rateLimit,
    validator,
    async (req, res, next) => {
        try {
            const memberRepo = new cinerino.repository.Member(mongoose.connection);
            const members = await memberRepo.search({
                member: { id: { $eq: req.user.sub } },
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

export default iamMeRouter;
