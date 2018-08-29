/**
 * 予約ルーター
 */
import { Router } from 'express';

import eventReservationRouter from './reservations/eventReservation';

const reservationsRouter = Router();
reservationsRouter.use('/eventReservation', eventReservationRouter);
export default reservationsRouter;
