/**
 * 決済ルーター
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';

import accountPaymentRouter from './payment/account';
import anyPaymentRouter from './payment/any';
import creditCardPaymentRouter from './payment/creditCard';
import movieTicketPaymentRouter from './payment/movieTicket';
import paymentCardPaymentRouter from './payment/paymentCard';

const paymentRouter = Router();

paymentRouter.use('/any', anyPaymentRouter);
paymentRouter.use(`/${cinerino.factory.chevre.service.paymentService.PaymentServiceType.Account}`, accountPaymentRouter);
paymentRouter.use(`/${cinerino.factory.chevre.service.paymentService.PaymentServiceType.CreditCard}`, creditCardPaymentRouter);
paymentRouter.use(`/${cinerino.factory.chevre.service.paymentService.PaymentServiceType.MovieTicket}`, movieTicketPaymentRouter);
paymentRouter.use(`/${cinerino.factory.chevre.service.paymentService.PaymentServiceType.PaymentCard}`, paymentCardPaymentRouter);

export default paymentRouter;
