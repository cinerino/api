/**
 * 組織ルーター
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';
import * as mongoose from 'mongoose';

import permitScopes from '../middlewares/permitScopes';
import rateLimit from '../middlewares/rateLimit';
import validator from '../middlewares/validator';

const organizationsRouter = Router();

/**
 * @deprecated Use /sellers
 */
organizationsRouter.get(
    '/movieTheater',
    permitScopes(['sellers.read']),
    rateLimit,
    validator,
    async (req, res, next) => {
        try {
            const searchCoinditions: cinerino.factory.seller.ISearchConditions = {
                ...req.query,
                project: { ids: [req.project.id] },
                // tslint:disable-next-line:no-magic-numbers
                limit: (req.query.limit !== undefined) ? Math.min(req.query.limit, 100) : 100,
                page: (req.query.page !== undefined) ? Math.max(req.query.page, 1) : 1
            };

            const sellerRepo = new cinerino.repository.Seller(mongoose.connection);
            const sellers = await sellerRepo.search(
                searchCoinditions,
                // 管理者以外にセキュアな情報を露出しないように
                (!req.isAdmin) ? { 'paymentAccepted.gmoInfo.shopPass': 0 } : undefined
            );
            const totalCount = await sellerRepo.count(searchCoinditions);

            res.set('X-Total-Count', totalCount.toString());
            res.json(sellers);
        } catch (error) {
            next(error);
        }
    }
);

export default organizationsRouter;
