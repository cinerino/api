/**
 * IAMロールルーター
 */
import * as cinerino from '@cinerino/domain';
import * as express from 'express';
import * as mongoose from 'mongoose';

import permitScopes from '../../middlewares/permitScopes';
import rateLimit from '../../middlewares/rateLimit';
import validator from '../../middlewares/validator';

const iamRolesRouter = express.Router();

/**
 * IAMロール検索
 */
iamRolesRouter.get(
    '',
    permitScopes(['iam.roles.read']),
    rateLimit,
    validator,
    async (req, res, next) => {
        try {
            const searchCoinditions: any = {
                ...req.query,
                // tslint:disable-next-line:no-magic-numbers
                limit: (req.query.limit !== undefined) ? Math.min(req.query.limit, 100) : 100,
                page: (req.query.page !== undefined) ? Math.max(req.query.page, 1) : 1
            };

            const roleRepo = new cinerino.repository.Role(mongoose.connection);
            const roles = await roleRepo.search(searchCoinditions);
            const totalCount = await roleRepo.count(searchCoinditions);

            res.set('X-Total-Count', totalCount.toString());
            res.json(roles);
        } catch (error) {
            next(error);
        }
    }
);

export default iamRolesRouter;
