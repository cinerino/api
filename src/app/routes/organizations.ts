/**
 * 組織ルーター
 */
import { Router } from 'express';

import movieTheaterRouter from './organizations/movieTheater';

const organizationsRouter = Router();
organizationsRouter.use('/movieTheater', movieTheaterRouter);
export default organizationsRouter;
