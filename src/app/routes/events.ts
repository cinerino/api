/**
 * イベントルーター
 */
import { Router } from 'express';

import screeningEventRouter from './events/screeningEvent';

import authentication from '../middlewares/authentication';

const eventsRouter = Router();
eventsRouter.use(authentication);

eventsRouter.use('/screeningEvent', screeningEventRouter);

export default eventsRouter;
