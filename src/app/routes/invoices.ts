/**
 * インボイスルーター
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';
import { query } from 'express-validator';
import * as mongoose from 'mongoose';

import permitScopes from '../middlewares/permitScopes';
import rateLimit from '../middlewares/rateLimit';
import validator from '../middlewares/validator';

const invoicesRouter = Router();

/**
 * インボイス検索
 */
invoicesRouter.get(
    '',
    permitScopes(['invoices.*', 'invoices.read']),
    rateLimit,
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
                project: { id: { $eq: req.project.id } },
                // tslint:disable-next-line:no-magic-numbers
                limit: (req.query.limit !== undefined) ? Math.min(req.query.limit, 100) : 100,
                page: (req.query.page !== undefined) ? Math.max(req.query.page, 1) : 1
            };

            const invoices = await invoiceRepo.search(searchConditions);

            res.json(invoices);
        } catch (error) {
            next(error);
        }
    }
);

export default invoicesRouter;
