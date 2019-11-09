/**
 * 注文取引ルーター(ttts専用)
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';
import { CREATED, NO_CONTENT } from 'http-status';
import * as moment from 'moment-timezone';
import * as mongoose from 'mongoose';

const placeOrderTransactionsRouter = Router();

import authentication from '../../../middlewares/authentication';
import permitScopes from '../../../middlewares/permitScopes';
import validator from '../../../middlewares/validator';

import * as redis from '../../../../redis';

placeOrderTransactionsRouter.use(authentication);

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
                new cinerino.repository.PaymentNo(redis.getClient()),
                new cinerino.repository.rateLimit.TicketTypeCategory(redis.getClient()),
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
                new cinerino.repository.rateLimit.TicketTypeCategory(redis.getClient()),
                new cinerino.repository.Project(mongoose.connection)
            );

            res.status(NO_CONTENT)
                .end();
        } catch (error) {
            next(error);
        }
    }
);

export function createConfirmationNumber(params: {
    transactionId: string;
    authorizeSeatReservationResult:
    cinerino.factory.action.authorize.offer.seatReservation.IResult<cinerino.factory.service.webAPI.Identifier.Chevre>;
}): string {
    const reserveTransaction = params.authorizeSeatReservationResult.responseBody;
    if (reserveTransaction === undefined) {
        throw new cinerino.factory.errors.Argument('Transaction', 'Reserve trasaction required');
    }
    const chevreReservations = (Array.isArray(reserveTransaction.object.reservations))
        ? reserveTransaction.object.reservations
        : [];
    const event = reserveTransaction.object.reservationFor;
    if (event === undefined || event === null) {
        throw new cinerino.factory.errors.Argument('Transaction', 'Event required');
    }

    // 確認番号を事前生成
    const eventStartDateStr = moment(event.startDate)
        .tz('Asia/Tokyo')
        .format('YYYYMMDD');

    let paymentNo: string | undefined;
    if (chevreReservations[0].underName !== undefined && Array.isArray(chevreReservations[0].underName.identifier)) {
        const paymentNoProperty = chevreReservations[0].underName.identifier.find((p) => p.name === 'paymentNo');
        if (paymentNoProperty !== undefined) {
            paymentNo = paymentNoProperty.value;
        }
    }
    if (paymentNo === undefined) {
        throw new cinerino.factory.errors.ServiceUnavailable('Payment No not found');
    }

    return `${eventStartDateStr}${paymentNo}`;
}

export function getTmpReservations(params: {
    transaction: { id: string };
}) {
    return async (repos: {
        action: cinerino.repository.Action;
    }): Promise<cinerino.factory.action.authorize.offer.seatReservation.IResult<cinerino.factory.service.webAPI.Identifier.Chevre>> => {
        const authorizeActions = await repos.action.searchByPurpose({
            typeOf: cinerino.factory.actionType.AuthorizeAction,
            purpose: {
                typeOf: cinerino.factory.transactionType.PlaceOrder,
                id: params.transaction.id
            }
        });
        const seatReservationAuthorizeActions
            = <cinerino.factory.action.authorize.offer.seatReservation.IAction<cinerino.factory.service.webAPI.Identifier.Chevre>[]>
            authorizeActions
                .filter((a) => a.actionStatus === cinerino.factory.actionStatusType.CompletedActionStatus)
                .filter((a) => a.object.typeOf === cinerino.factory.action.authorize.offer.seatReservation.ObjectType.SeatReservation);
        if (seatReservationAuthorizeActions.length > 1) {
            throw new cinerino.factory.errors.Argument('Transaction', 'Number of seat reservations must be 1');
        }
        const seatReservationAuthorizeAction = seatReservationAuthorizeActions.shift();
        if (seatReservationAuthorizeAction === undefined || seatReservationAuthorizeAction.result === undefined) {
            throw new cinerino.factory.errors.Argument('Transaction', 'Seat reservation authorize action required');
        }

        return seatReservationAuthorizeAction.result;
    };
}

export default placeOrderTransactionsRouter;
