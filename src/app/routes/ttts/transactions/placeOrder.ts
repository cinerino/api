/**
 * 注文取引ルーター(ttts専用)
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';
import { CREATED, NO_CONTENT } from 'http-status';
import * as mongoose from 'mongoose';

const placeOrderTransactionsRouter = Router();

import permitScopes from '../../../middlewares/permitScopes';
import validator from '../../../middlewares/validator';

// import * as redis from '../../../../redis';

/**
 * 座席仮予約
 */
placeOrderTransactionsRouter.post(
    '/:transactionId/actions/authorize/seatReservation',
    permitScopes(['transactions', 'pos']),
    validator,
    async (req, res, next) => {
        try {
            if (!Array.isArray(req.body.offers)) {
                req.body.offers = [];
            }

            const performanceId: string = req.body.performance_id;

            const action = await cinerino.service.transaction.placeOrderInProgress.action.authorize.offer.seatReservation4ttts.create({
                project: req.project,
                agent: { id: req.user.sub },
                transaction: { id: req.params.transactionId },
                object: {
                    event: { id: performanceId },
                    acceptedOffer: [],
                    acceptedOffers: (<any[]>req.body.offers).map((offer) => {
                        return {
                            ticket_type: offer.ticket_type,
                            watcher_name: offer.watcher_name
                        };
                    })
                }
            })(
                new cinerino.repository.Action(mongoose.connection),
                // new cinerino.repository.rateLimit.TicketTypeCategory(redis.getClient()),
                new cinerino.repository.Transaction(mongoose.connection),
                new cinerino.repository.Project(mongoose.connection)
            );

            res.status(CREATED)
                .json(action);
        } catch (error) {
            next(error);
        }
    }
);

/**
 * 座席仮予約削除
 */
placeOrderTransactionsRouter.delete(
    '/:transactionId/actions/authorize/seatReservation/:actionId',
    permitScopes(['transactions', 'pos']),
    validator,
    async (req, res, next) => {
        try {
            await cinerino.service.transaction.placeOrderInProgress.action.authorize.offer.seatReservation4ttts.cancel({
                project: req.project,
                agent: { id: req.user.sub },
                transaction: { id: req.params.transactionId },
                id: req.params.actionId
            })(
                new cinerino.repository.Transaction(mongoose.connection),
                new cinerino.repository.Action(mongoose.connection),
                // new cinerino.repository.rateLimit.TicketTypeCategory(redis.getClient()),
                new cinerino.repository.Project(mongoose.connection)
            );

            res.status(NO_CONTENT)
                .end();
        } catch (error) {
            next(error);
        }
    }
);

export default placeOrderTransactionsRouter;
