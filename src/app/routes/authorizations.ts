/**
 * 承認ルーター
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';
import { query } from 'express-validator';
import * as mongoose from 'mongoose';

import permitScopes from '../middlewares/permitScopes';
import rateLimit from '../middlewares/rateLimit';
import validator from '../middlewares/validator';

const authorizationsRouter = Router();

/**
 * 承認検索
 */
authorizationsRouter.get(
    '',
    permitScopes(['authorizations.*', 'authorizations.read']),
    rateLimit,
    ...[
        query('validFrom')
            .optional()
            .isISO8601()
            .toDate(),
        query('validThrough')
            .optional()
            .isISO8601()
            .toDate()
    ],
    validator,
    async (req, res, next) => {
        try {
            const authorizationRepo = new cinerino.repository.Code(mongoose.connection);

            const searchConditions: cinerino.factory.authorization.ISearchConditions = {
                ...req.query,
                project: { id: { $eq: req.project.id } },
                // tslint:disable-next-line:no-magic-numbers
                limit: (req.query.limit !== undefined) ? Math.min(req.query.limit, 100) : 100,
                page: (req.query.page !== undefined) ? Math.max(req.query.page, 1) : 1
            };

            const authorizations = await authorizationRepo.search(searchConditions);

            res.json(authorizations);
        } catch (error) {
            next(error);
        }
    }
);

export default authorizationsRouter;
