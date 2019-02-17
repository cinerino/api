/**
 * ムビチケ決済方法ルーター
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';
import * as mongoose from 'mongoose';

import authentication from '../../middlewares/authentication';
import permitScopes from '../../middlewares/permitScopes';
import validator from '../../middlewares/validator';

const movieTicketPaymentMethodsRouter = Router();
movieTicketPaymentMethodsRouter.use(authentication);

movieTicketPaymentMethodsRouter.get(
    '',
    permitScopes(['admin']),
    validator,
    async (req, res, next) => {
        try {
            const paymentMethodRepo = new cinerino.repository.PaymentMethod(mongoose.connection);
            const searchCoinditions = {
                ...req.query,
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
