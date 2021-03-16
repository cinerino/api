/**
 * 決済ルーター
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';

import creditCardPaymentRouter from './payment/creditCard';
import faceToFacePaymentRouter from './payment/faceToFace';
import movieTicketPaymentRouter from './payment/movieTicket';
import paymentCardPaymentRouter from './payment/paymentCard';

const paymentRouter = Router();

paymentRouter.use('/any', faceToFacePaymentRouter);
paymentRouter.use(`/${cinerino.factory.chevre.service.paymentService.PaymentServiceType.FaceToFace}`, faceToFacePaymentRouter);
paymentRouter.use(`/${cinerino.factory.chevre.service.paymentService.PaymentServiceType.CreditCard}`, creditCardPaymentRouter);
paymentRouter.use(`/${cinerino.factory.chevre.service.paymentService.PaymentServiceType.MovieTicket}`, movieTicketPaymentRouter);
paymentRouter.use(`/${cinerino.factory.chevre.service.paymentService.PaymentServiceType.PaymentCard}`, paymentCardPaymentRouter);
paymentRouter.use(`/Account`, paymentCardPaymentRouter); // PaymentCardに統合前に対する互換性維持対応

export default paymentRouter;
