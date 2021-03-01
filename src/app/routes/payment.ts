/**
 * 決済ルーター
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';

import anyPaymentRouter from './payment/any';
import creditCardPaymentRouter from './payment/creditCard';
import faceToFacePaymentRouter from './payment/faceToFace';
import movieTicketPaymentRouter from './payment/movieTicket';
import paymentCardPaymentRouter from './payment/paymentCard';

const USE_FACE_TO_FACE_PAYMENT = process.env.USE_FACE_TO_FACE_PAYMENT === '1';

const paymentRouter = Router();

if (USE_FACE_TO_FACE_PAYMENT) {
    paymentRouter.use('/any', faceToFacePaymentRouter);
} else {
    paymentRouter.use('/any', anyPaymentRouter);
}
paymentRouter.use(`/Account`, paymentCardPaymentRouter); // PaymentCardに統合前に対する互換性維持対応
paymentRouter.use(`/${cinerino.factory.chevre.service.paymentService.PaymentServiceType.CreditCard}`, creditCardPaymentRouter);
paymentRouter.use(`/${cinerino.factory.chevre.service.paymentService.PaymentServiceType.MovieTicket}`, movieTicketPaymentRouter);
paymentRouter.use(`/${cinerino.factory.chevre.service.paymentService.PaymentServiceType.PaymentCard}`, paymentCardPaymentRouter);

export default paymentRouter;
