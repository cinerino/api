/**
 * 顧客ルーター
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';

import permitScopes from '../middlewares/permitScopes';
import rateLimit from '../middlewares/rateLimit';
import validator from '../middlewares/validator';

const customersRouter = Router();

/**
 * 顧客検索
 */
customersRouter.get(
    '',
    permitScopes(['customers.*', 'customers.read']),
    rateLimit,
    validator,
    async (req, res, next) => {
        try {
            const customerService = new cinerino.chevre.service.Customer({
                endpoint: cinerino.credentials.chevre.endpoint,
                auth: req.chevreAuthClient,
                project: { id: req.project.id }
            });

            const { data } = await customerService.search({
                ...req.query,
                project: { id: { $eq: req.project.id } }
            });

            res.json(data);
        } catch (error) {
            next(error);
        }
    }
);

/**
 * IDで顧客検索
 */
customersRouter.get(
    '/:id',
    permitScopes(['customers.*', 'customers.read']),
    rateLimit,
    validator,
    async (req, res, next) => {
        try {
            const customerService = new cinerino.chevre.service.Customer({
                endpoint: cinerino.credentials.chevre.endpoint,
                auth: req.chevreAuthClient,
                project: { id: req.project.id }
            });

            const customer = await customerService.findById({ id: req.params.id });

            res.json(customer);
        } catch (error) {
            next(error);
        }
    }
);

export default customersRouter;
