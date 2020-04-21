/**
 * プロジェクト詳細ルーター
 */
import * as cinerino from '@cinerino/domain';
import * as express from 'express';

import healthRouter from '../health';
import statsRouter from '../stats';

import accountsRouter from '../accounts';
import actionsRouter from '../actions';
import authorizationsRouter from '../authorizations';
import creativeWorksRouter from '../creativeWorks';
import eventsRouter from '../events';
import iamRouter from '../iam';
import invoicesRouter from '../invoices';
import membersRouter from '../members';
import offersRouter from '../offers';
import ordersRouter from '../orders';
import organizationsRouter from '../organizations';
import ownershipInfosRouter from '../ownershipInfos';
import paymentRouter from '../payment';
import paymentMethodsRouter from '../paymentMethods';
import peopleRouter from '../people';
import meRouter from '../people/me';
import placesRouter from '../place';
import programMembershipsRouter from '../programMembership';
import reservationsRouter from '../reservations';
import sellersRouter from '../sellers';
import tasksRouter from '../tasks';
import transactionsRouter from '../transactions';
import tttsRouter from '../ttts';
import userPoolsRouter from '../userPools';

const projectDetailRouter = express.Router();

projectDetailRouter.use((req, _, next) => {
    // プロジェクト未指定は拒否
    if (req.project === undefined || req.project === null || typeof req.project.id !== 'string') {
        next(new cinerino.factory.errors.Forbidden('project not specified'));

        return;
    }

    next();
});

projectDetailRouter.use('/health', healthRouter);
projectDetailRouter.use('/stats', statsRouter);

projectDetailRouter.use('/accounts', accountsRouter);
projectDetailRouter.use('/actions', actionsRouter);
projectDetailRouter.use('/authorizations', authorizationsRouter);
projectDetailRouter.use('/creativeWorks', creativeWorksRouter);
projectDetailRouter.use('/events/screeningEvent', eventsRouter);
projectDetailRouter.use('/events', eventsRouter);
projectDetailRouter.use('/iam', iamRouter);
projectDetailRouter.use('/invoices', invoicesRouter);
projectDetailRouter.use('/members', membersRouter);
projectDetailRouter.use('/offers', offersRouter);
projectDetailRouter.use('/orders', ordersRouter);
projectDetailRouter.use('/organizations', organizationsRouter);
projectDetailRouter.use('/ownershipInfos', ownershipInfosRouter);
projectDetailRouter.use('/payment', paymentRouter);
projectDetailRouter.use('/paymentMethods', paymentMethodsRouter);
projectDetailRouter.use('/people/me', meRouter);
projectDetailRouter.use('/people', peopleRouter);
projectDetailRouter.use('/places', placesRouter);
projectDetailRouter.use('/programMemberships', programMembershipsRouter);
projectDetailRouter.use('/reservations', reservationsRouter);
projectDetailRouter.use('/sellers', sellersRouter);
projectDetailRouter.use('/tasks', tasksRouter);
projectDetailRouter.use('/transactions', transactionsRouter);
projectDetailRouter.use('/ttts', tttsRouter);
projectDetailRouter.use('/userPools', userPoolsRouter);

export default projectDetailRouter;
