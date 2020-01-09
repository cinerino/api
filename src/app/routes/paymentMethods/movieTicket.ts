/**
 * ムビチケ決済方法ルーター
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';
import * as mongoose from 'mongoose';

import permitScopes from '../../middlewares/permitScopes';
import rateLimit from '../../middlewares/rateLimit';
import validator from '../../middlewares/validator';

const movieTicketPaymentMethodsRouter = Router();

movieTicketPaymentMethodsRouter.get(
    '',
    permitScopes(['paymentMethods.*', 'paymentMethods.read']),
    rateLimit,
    validator,
    async (req, res, next) => {
        try {
            const paymentMethodRepo = new cinerino.repository.PaymentMethod(mongoose.connection);
            const searchCoinditions = {
                ...req.query,
                project: { ids: [req.project.id] },
                // tslint:disable-next-line:no-magic-numbers
                limit: (req.query.limit !== undefined) ? Math.min(req.query.limit, 100) : 100,
                page: (req.query.page !== undefined) ? Math.max(req.query.page, 1) : 1
            };
            const paymentMethods = await paymentMethodRepo.searchMovieTickets(searchCoinditions);
            const totalCount = await paymentMethodRepo.countMovieTickets(searchCoinditions);
            res.set('X-Total-Count', totalCount.toString());
            res.json(paymentMethods);
        } catch (error) {
            next(error);
        }
    }
);

export default movieTicketPaymentMethodsRouter;
