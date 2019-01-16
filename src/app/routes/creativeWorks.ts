/**
 * 作品ルーター
 */
import { Router } from 'express';

import movieRouter from './creativeWorks/movie';

const creativeWorksRouter = Router();
creativeWorksRouter.use('/movie', movieRouter);
export default creativeWorksRouter;
