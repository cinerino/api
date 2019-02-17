/**
 * 自分の注文ルーター
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';
import * as mongoose from 'mongoose';

import authentication from '../../../middlewares/authentication';
import permitScopes from '../../../middlewares/permitScopes';
import validator from '../../../middlewares/validator';

const ordersRouter = Router();
ordersRouter.use(authentication);
/**
 * 注文検索
 */
ordersRouter.get(
    '',
    permitScopes(['aws.cognito.signin.user.admin']),
    (req, __2, next) => {
        req.checkQuery('orderDateFrom')
            .notEmpty()
            .withMessage('required')
            .isISO8601()
            .withMessage('must be ISO8601')
            .toDate();
        req.checkQuery('orderDateThrough')
            .notEmpty()
            .withMessage('required')
            .isISO8601()
            .withMessage('must be ISO8601')
            .toDate();
        next();
    },
    validator,
    async (req, res, next) => {
        try {
            const orderRepo = new cinerino.repository.Order(mongoose.connection);
            const searchConditions: cinerino.factory.order.ISearchConditions = {
                ...req.query,
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
