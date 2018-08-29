/**
 * イベントルーター
 */
import { Router } from 'express';

import screeningEventRouter from './events/screeningEvent';

const eventsRouter = Router();
eventsRouter.use('/screeningEvent', screeningEventRouter);
export default eventsRouter;
