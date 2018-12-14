/**
 * ルーター
 */
import * as express from 'express';

import eventsRouter from './events';
import healthRouter from './health';
import ordersRouter from './orders';
import organizationsRouter from './organizations';
import ownershipInfosRouter from './ownershipInfos';
import paymentRouter from './payment';
import paymentMethodsRouter from './paymentMethods';
import peopleRouter from './people';
import meRouter from './people/me';
import reservationsRouter from './reservations';
import tasksRouter from './tasks';
import transactionsRouter from './transactions';
import userPoolsRouter from './userPools';

const router = express.Router();

// middleware that is specific to this router
// router.use((req, res, next) => {
//   debug('Time: ', Date.now())
//   next()
// })

router.use('/health', healthRouter);
router.use('/organizations', organizationsRouter);
router.use('/orders', ordersRouter);
router.use('/ownershipInfos', ownershipInfosRouter);
router.use('/payment', paymentRouter);
router.use('/paymentMethods', paymentMethodsRouter);
router.use('/people/me', meRouter);
router.use('/people', peopleRouter);
router.use('/reservations', reservationsRouter);
router.use('/events', eventsRouter);
router.use('/tasks', tasksRouter);
router.use('/transactions', transactionsRouter);
router.use('/userPools', userPoolsRouter);

export default router;
