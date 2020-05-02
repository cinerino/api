/**
 * 決済方法ルーター
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';

import movieTicketPaymentMethodsRouter from './paymentMethods/movieTicket';
import prepaidCardPaymentMethodsRouter from './paymentMethods/prepaidCard';

const paymentMethodsRouter = Router();
paymentMethodsRouter.use(`/${cinerino.factory.paymentMethodType.MovieTicket}`, movieTicketPaymentMethodsRouter);
paymentMethodsRouter.use(`/${cinerino.factory.paymentMethodType.PrepaidCard}`, prepaidCardPaymentMethodsRouter);
export default paymentMethodsRouter;
