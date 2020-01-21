/**
 * 自分の注文ルーター
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';
import { query } from 'express-validator';
import * as mongoose from 'mongoose';

import permitScopes from '../../../middlewares/permitScopes';
import rateLimit from '../../../middlewares/rateLimit';
import validator from '../../../middlewares/validator';

const ordersRouter = Router();

/**
 * 注文検索
 */
ordersRouter.get(
    '',
    permitScopes(['people.me.*']),
    rateLimit,
    ...[
        query('orderDateFrom')
            .not()
            .isEmpty()
            .isISO8601()
            .toDate(),
        query('orderDateThrough')
            .not()
            .isEmpty()
            .isISO8601()
            .toDate()
    ],
    validator,
    async (req, res, next) => {
        try {
            const orderRepo = new cinerino.repository.Order(mongoose.connection);
            const searchConditions: cinerino.factory.order.ISearchConditions = {
                ...req.query,
                project: { id: { $eq: req.project.id } },
                // tslint:disable-next-line:no-magic-numbers
                limit: (req.query.limit !== undefined) ? Math.min(req.query.limit, 100) : 100,
                page: (req.query.page !== undefined) ? Math.max(req.query.page, 1) : 1,
                // customer条件を強制的に絞る
                customer: {
                    typeOf: cinerino.factory.personType.Person,
                    ids: [req.user.sub]
                }
            };
            const orders = await orderRepo.search(searchConditions);
            const totalCount = await orderRepo.count(searchConditions);
            res.set('X-Total-Count', totalCount.toString());
            res.json(orders);
        } catch (error) {
            next(error);
        }
    }
);

export default ordersRouter;
