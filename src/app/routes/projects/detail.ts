/**
 * プロジェクト詳細ルーター
 */
import * as cinerino from '@cinerino/domain';
import * as express from 'express';

import healthRouter from '../health';
import statsRouter from '../stats';

import accountsRouter from '../accounts';
import actionsRouter from '../actions';
import categoryCodesRouter from '../categoryCode';
import creativeWorksRouter from '../creativeWorks';
import customersRouter from '../customers';
import eventsRouter from '../events';
import iamRouter from '../iam';
import membersRouter from '../members';
import offersRouter from '../offers';
import ordersRouter from '../orders';
import ownershipInfosRouter from '../ownershipInfos';
import paymentRouter from '../payment';
import peopleRouter from '../people';
import meRouter from '../people/me';
import placesRouter from '../place';
import productsRouter from '../products';
import reservationsRouter from '../reservations';
import sellersRouter from '../sellers';
import serviceOutputsRouter from '../serviceOutputs';
import tokensRouter from '../tokens';
import transactionsRouter from '../transactions';
import tttsRouter from '../ttts';
import userPoolsRouter from '../userPools';

const projectDetailRouter = express.Router();

projectDetailRouter.use((req, _, next) => {
    // プロジェクト未指定は拒否
    if (typeof req.project?.id !== 'string') {
        next(new cinerino.factory.errors.Forbidden('project not specified'));

        return;
    }

    next();
});

projectDetailRouter.use('/health', healthRouter);
projectDetailRouter.use('/stats', statsRouter);

projectDetailRouter.use('/accounts', accountsRouter);
projectDetailRouter.use('/actions', actionsRouter);
projectDetailRouter.use('/categoryCodes', categoryCodesRouter);
projectDetailRouter.use('/creativeWorks', creativeWorksRouter);
projectDetailRouter.use('/customers', customersRouter);
projectDetailRouter.use('/events/screeningEvent', eventsRouter);
projectDetailRouter.use('/events', eventsRouter);
projectDetailRouter.use('/iam', iamRouter);
projectDetailRouter.use('/members', membersRouter);
projectDetailRouter.use('/offers', offersRouter);
projectDetailRouter.use('/orders', ordersRouter);
projectDetailRouter.use('/ownershipInfos', ownershipInfosRouter);
projectDetailRouter.use('/payment', paymentRouter);
projectDetailRouter.use('/people/me', meRouter);
projectDetailRouter.use('/people', peopleRouter);
projectDetailRouter.use('/places', placesRouter);
projectDetailRouter.use('/products', productsRouter);
projectDetailRouter.use('/reservations', reservationsRouter);
projectDetailRouter.use('/sellers', sellersRouter);
projectDetailRouter.use('/serviceOutputs', serviceOutputsRouter);
projectDetailRouter.use('/tokens', tokensRouter);
projectDetailRouter.use('/transactions', transactionsRouter);
projectDetailRouter.use('/ttts', tttsRouter);
projectDetailRouter.use('/userPools', userPoolsRouter);

export default projectDetailRouter;
