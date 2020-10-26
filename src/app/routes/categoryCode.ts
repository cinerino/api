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

const chevreAuthClient = new cinerino.chevre.auth.ClientCredentials({
    domain: <string>process.env.CHEVRE_AUTHORIZE_SERVER_DOMAIN,
    clientId: <string>process.env.CHEVRE_CLIENT_ID,
    clientSecret: <string>process.env.CHEVRE_CLIENT_SECRET,
    scopes: [],
    state: ''
});

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
            const searchConditions: any = {
                ...req.query,
                project: { id: { $eq: req.project.id } },
                // tslint:disable-next-line:no-magic-numbers
                limit: (req.query.limit !== undefined) ? Math.min(req.query.limit, 100) : undefined,
                page: (req.query.page !== undefined) ? Math.max(req.query.page, 1) : undefined
            };

            const categoryCodeService = new cinerino.chevre.service.CategoryCode({
                endpoint: cinerino.credentials.chevre.endpoint,
                auth: chevreAuthClient
            });
            const { data } = await categoryCodeService.search(searchConditions);

            res.json(data);
        } catch (error) {
            next(error);
        }
    }
);

export default categoryCodesRouter;
