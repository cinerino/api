/**
 * インボイスルーター
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';
// tslint:disable-next-line:no-submodule-imports
import { query } from 'express-validator/check';
import * as mongoose from 'mongoose';

import authentication from '../middlewares/authentication';
import permitScopes from '../middlewares/permitScopes';
import validator from '../middlewares/validator';

const MULTI_TENANT_SUPPORTED = process.env.MULTI_TENANT_SUPPORTED === '1';

const invoicesRouter = Router();
invoicesRouter.use(authentication);

/**
 * インボイス検索
 */
invoicesRouter.get(
    '',
    permitScopes([]),
    ...[
        query('createdFrom')
            .optional()
            .isISO8601()
            .withMessage((_, options) => `${options.path} must be ISO8601 timestamp`)
            .toDate(),
        query('createdThrough')
            .optional()
            .isISO8601()
            .withMessage((_, options) => `${options.path} must be ISO8601 timestamp`)
            .toDate()
    ],
    validator,
    async (req, res, next) => {
        try {
            const invoiceRepo = new cinerino.repository.Invoice(mongoose.connection);

            const searchConditions: cinerino.factory.invoice.ISearchConditions = {
                ...req.query,
                project: (MULTI_TENANT_SUPPORTED) ? { ids: [req.project.id] } : undefined,
                // tslint:disable-next-line:no-magic-numbers
                limit: (req.query.limit !== undefined) ? Math.min(req.query.limit, 100) : 100,
                page: (req.query.page !== undefined) ? Math.max(req.query.page, 1) : 1
            };

            const totalCount = await invoiceRepo.count(searchConditions);
            const invoices = await invoiceRepo.search(searchConditions);

            res.set('X-Total-Count', totalCount.toString());
            res.json(invoices);
        } catch (error) {
            next(error);
        }
    }
);

export default invoicesRouter;
