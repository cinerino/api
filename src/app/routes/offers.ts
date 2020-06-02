/**
 * オファールーター
 */
import { Router } from 'express';

import monetaryAmountOffersRouter from './offers/monetaryAmount';
import paymentCardOffersRouter from './offers/paymentCard';

const offersRouter = Router();
offersRouter.use('/monetaryAmount', monetaryAmountOffersRouter);
offersRouter.use('/paymentCard', paymentCardOffersRouter);
export default offersRouter;
