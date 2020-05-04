/**
 * ムビチケ決済方法ルーター
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';
import { query } from 'express-validator';
import * as mongoose from 'mongoose';

import permitScopes from '../../middlewares/permitScopes';
import rateLimit from '../../middlewares/rateLimit';
import validator from '../../middlewares/validator';

const movieTicketPaymentMethodsRouter = Router();

movieTicketPaymentMethodsRouter.get(
    '',
    permitScopes(['paymentMethods.*', 'paymentMethods.read']),
    rateLimit,
    ...[
        query('limit')
            .optional()
            .isInt()
            .toInt(),
        query('page')
            .optional()
            .isInt()
            .toInt()
    ],
    validator,
    async (req, res, next) => {
        try {
            const paymentMethodRepo = new cinerino.repository.PaymentMethod(mongoose.connection);

            const searchConditions: cinerino.factory.paymentMethod.ISearchConditions<cinerino.factory.paymentMethodType.MovieTicket> = {
                ...req.query,
                project: { ids: [req.project.id] },
                // tslint:disable-next-line:no-magic-numbers
                limit: (req.query.limit !== undefined) ? Math.min(req.query.limit, 100) : 100,
                page: (req.query.page !== undefined) ? Math.max(req.query.page, 1) : 1,
                typeOf: { $eq: cinerino.factory.paymentMethodType.MovieTicket }
            };

            const paymentMethods = await paymentMethodRepo.search(searchConditions);

            res.json(paymentMethods);
        } catch (error) {
            next(error);
        }
    }
);

export default movieTicketPaymentMethodsRouter;
