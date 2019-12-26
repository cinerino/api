/**
 * 決済方法ルーター
 */
import { Router } from 'express';

import movieTicketPaymentMethodsRouter from './paymentMethods/movieTicket';

const paymentMethodsRouter = Router();
paymentMethodsRouter.use('/movieTicket', movieTicketPaymentMethodsRouter);
export default paymentMethodsRouter;
