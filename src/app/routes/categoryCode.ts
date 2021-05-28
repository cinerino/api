/**
 * カテゴリーコードルーター
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';
// tslint:disable-next-line:no-implicit-dependencies
// import { ParamsDictionary } from 'express-serve-static-core';
// import { query } from 'express-validator';

import permitScopes from '../middlewares/permitScopes';
import rateLimit from '../middlewares/rateLimit';
import validator from '../middlewares/validator';

const categoryCodesRouter = Router();

/**
 * 検索
 */
categoryCodesRouter.get(
    '',
    permitScopes(['categoryCodes.*', 'categoryCodes.read']),
    rateLimit,
    validator,
    async (req, res, next) => {
        try {
            const searchConditions: cinerino.factory.chevre.categoryCode.ISearchConditions = {
                ...req.query,
                project: { id: { $eq: req.project.id } },
                // tslint:disable-next-line:no-magic-numbers
                limit: (req.query.limit !== undefined) ? Math.min(req.query.limit, 100) : undefined,
                page: (req.query.page !== undefined) ? Math.max(req.query.page, 1) : undefined
            };

            const categoryCodeService = new cinerino.chevre.service.CategoryCode({
                endpoint: cinerino.credentials.chevre.endpoint,
                auth: req.chevreAuthClient,
                project: { id: req.project.id }
            });
            const { data } = await categoryCodeService.search(searchConditions);

            res.json(data);
        } catch (error) {
            next(error);
        }
    }
);

export default categoryCodesRouter;
