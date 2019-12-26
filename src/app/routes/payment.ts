/**
 * 決済ルーター
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';

import accountPaymentRouter from './payment/account';
import anyPaymentRouter from './payment/any';
import creditCardPaymentRouter from './payment/creditCard';
import movieTicketPaymentRouter from './payment/movieTicket';

const paymentRouter = Router();

paymentRouter.use('/any', anyPaymentRouter);
paymentRouter.use(`/${cinerino.factory.paymentMethodType.Account}`, accountPaymentRouter);
paymentRouter.use(`/${cinerino.factory.paymentMethodType.CreditCard}`, creditCardPaymentRouter);
paymentRouter.use(`/${cinerino.factory.paymentMethodType.MovieTicket}`, movieTicketPaymentRouter);

export default paymentRouter;
