/**
 * 決済方法ルーター
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';

import movieTicketPaymentMethodsRouter from './paymentMethods/movieTicket';

const paymentMethodsRouter = Router();
paymentMethodsRouter.use(`/${cinerino.factory.paymentMethodType.MovieTicket}`, movieTicketPaymentMethodsRouter);
export default paymentMethodsRouter;
