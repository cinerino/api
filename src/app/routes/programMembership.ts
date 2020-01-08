/**
 * 会員プログラムルーター
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';
import * as mongoose from 'mongoose';

import permitScopes from '../middlewares/permitScopes';
import rateLimit from '../middlewares/rateLimit';
import validator from '../middlewares/validator';

import { Permission } from '../iam';

const programMembershipsRouter = Router();

/**
 * 会員プログラム検索
 */
programMembershipsRouter.get(
    '',
    permitScopes([Permission.User, 'customer', 'programMemberships.*', 'programMemberships.read', 'programMemberships', 'programMemberships.read-only']),
    rateLimit,
    validator,
    async (req, res, next) => {
        try {
            const programMembershipRepo = new cinerino.repository.ProgramMembership(mongoose.connection);

            const searchConditions: cinerino.factory.programMembership.ISearchConditions = {
                ...req.query,
                project: { id: { $eq: req.project.id } },
                // tslint:disable-next-line:no-magic-numbers
                limit: (req.query.limit !== undefined) ? Math.min(req.query.limit, 100) : 100,
                page: (req.query.page !== undefined) ? Math.max(req.query.page, 1) : 1
            };

            const totalCount = await programMembershipRepo.count(searchConditions);
            const programMemberships = await programMembershipRepo.search(searchConditions);

            res.set('X-Total-Count', totalCount.toString());
            res.json(programMemberships);
        } catch (error) {
            next(error);
        }
    }
);

export default programMembershipsRouter;
