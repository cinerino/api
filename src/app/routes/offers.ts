/**
 * オファールーター
 */
import { Router } from 'express';

import monetaryAmountOffersRouter from './offers/monetaryAmount';
import productOffersRouter from './offers/product';

const offersRouter = Router();
offersRouter.use('/monetaryAmount', monetaryAmountOffersRouter);
offersRouter.use('/product', productOffersRouter);
export default offersRouter;
