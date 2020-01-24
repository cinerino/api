/**
 * プロジェクトメンバールーター
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';
// tslint:disable-next-line:no-implicit-dependencies
// import { ParamsDictionary } from 'express-serve-static-core';
// import { body } from 'express-validator';
// import { CREATED, NO_CONTENT } from 'http-status';
import * as mongoose from 'mongoose';

import permitScopes from '../middlewares/permitScopes';
import rateLimit from '../middlewares/rateLimit';
import validator from '../middlewares/validator';

const membersRouter = Router();

/**
 * プロジェクトメンバー検索
 */
membersRouter.get(
    '',
    permitScopes([]),
    rateLimit,
    validator,
    async (req, res, next) => {
        try {
            const searchCoinditions: cinerino.factory.seller.ISearchConditions = {
                ...req.query,
                project: { id: { $eq: req.project.id } },
                // tslint:disable-next-line:no-magic-numbers
                limit: (req.query.limit !== undefined) ? Math.min(req.query.limit, 100) : 100,
                page: (req.query.page !== undefined) ? Math.max(req.query.page, 1) : 1
            };

            const memberRepo = new cinerino.repository.Member(mongoose.connection);
            const members = await memberRepo.search(
                searchCoinditions
            );

            res.json(members);
        } catch (error) {
            next(error);
        }
    }
);

export default membersRouter;
