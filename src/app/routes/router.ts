/**
 * ルーター
 */
import * as express from 'express';

import accountsRouter from './accounts';
import actionsRouter from './actions';
import creativeWorksRouter from './creativeWorks';
import eventsRouter from './events';
import healthRouter from './health';
import iamRouter from './iam';
import invoicesRouter from './invoices';
import ordersRouter from './orders';
import organizationsRouter from './organizations';
import ownershipInfosRouter from './ownershipInfos';
import paymentRouter from './payment';
import paymentMethodsRouter from './paymentMethods';
import peopleRouter from './people';
import meRouter from './people/me';
import placesRouter from './places';
import programMembershipsRouter from './programMembership';
import reservationsRouter from './reservations';
import sellersRouter from './sellers';
import statsRouter from './stats';
import tasksRouter from './tasks';
import transactionsRouter from './transactions';
import userPoolsRouter from './userPools';

const router = express.Router();

// middleware that is specific to this router
// router.use((req, res, next) => {
//   debug('Time: ', Date.now())
//   next()
// })

router.use('/accounts', accountsRouter);
router.use('/actions', actionsRouter);
router.use('/creativeWorks', creativeWorksRouter);
router.use('/events', eventsRouter);
router.use('/health', healthRouter);
router.use('/iam', iamRouter);
router.use('/invoices', invoicesRouter);
router.use('/organizations', organizationsRouter);
router.use('/orders', ordersRouter);
router.use('/ownershipInfos', ownershipInfosRouter);
router.use('/payment', paymentRouter);
router.use('/paymentMethods', paymentMethodsRouter);
router.use('/people/me', meRouter);
router.use('/people', peopleRouter);
router.use('/places', placesRouter);
router.use('/programMemberships', programMembershipsRouter);
router.use('/reservations', reservationsRouter);
router.use('/sellers', sellersRouter);
router.use('/stats', statsRouter);
router.use('/tasks', tasksRouter);
router.use('/transactions', transactionsRouter);
router.use('/userPools', userPoolsRouter);

export default router;
