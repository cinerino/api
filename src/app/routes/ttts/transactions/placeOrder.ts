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

const chevreAuthClient = new cinerino.chevre.auth.ClientCredentials({
    domain: <string>process.env.CHEVRE_AUTHORIZE_SERVER_DOMAIN,
    clientId: <string>process.env.CHEVRE_CLIENT_ID,
    clientSecret: <string>process.env.CHEVRE_CLIENT_SECRET,
    scopes: [],
    state: ''
});

const mvtkReserveAuthClient = new cinerino.mvtkreserveapi.auth.ClientCredentials({
    domain: <string>process.env.MVTK_RESERVE_AUTHORIZE_SERVER_DOMAIN,
    clientId: <string>process.env.MVTK_RESERVE_CLIENT_ID,
    clientSecret: <string>process.env.MVTK_RESERVE_CLIENT_SECRET,
    scopes: [],
    state: ''
});

/**
 * 座席仮予約
 */
placeOrderTransactionsRouter.post(
    '/:transactionId/actions/authorize/seatReservation',
    permitScopes(['transactions', 'pos']),
    validator,
    async (req, res, next) => {
        try {
            const projectRepo = new cinerino.repository.Project(mongoose.connection);

            if (!Array.isArray(req.body.offers)) {
                req.body.offers = [];
            }

            const eventId: string = req.body.performance_id;
            const offers: {
                /**
                 * チケットコード(オファーIDではない)
                 */
                ticket_type: string;
                /**
                 * 予約メモ
                 */
                watcher_name: string;
            }[] = req.body.offers;

            // チケットオファー検索
            const project = await projectRepo.findById({ id: req.project.id });
            if (project.settings === undefined
                || project.settings.chevre === undefined) {
                throw new cinerino.factory.errors.ServiceUnavailable('Project settings undefined');
            }
            const eventService = new cinerino.chevre.service.Event({
                endpoint: project.settings.chevre.endpoint,
                auth: chevreAuthClient
            });
            const ticketOffers = await eventService.searchTicketOffers({ id: eventId });

            // Cinerino本家のacceptedOfferへ変換
            const acceptedOffer: cinerino.factory.action.authorize.offer.seatReservation.IAcceptedOfferWithoutDetail4chevre[]
                = offers.map((offer) => {
                    const ticketOffer = ticketOffers.find((t) => t.identifier === offer.ticket_type);
                    if (ticketOffer === undefined) {
                        throw new cinerino.factory.errors.NotFound('Offer', `Offer ${offer.ticket_type} not found`);
                    }

                    return {
                        id: ticketOffer.id, // オファーID
                        itemOffered: {
                            serviceOutput: {
                                typeOf: cinerino.factory.chevre.reservationType.EventReservation,
                                additionalTicketText: offer.watcher_name // 予約メモ
                            }
                        },
                        additionalProperty: []
                    };
                });

            const action = await cinerino.service.offer.seatReservation.create({
                autoSeatSelection: true,
                project: req.project,
                agent: { id: req.user.sub },
                transaction: { id: req.params.transactionId },
                object: {
                    event: { id: eventId },
                    acceptedOffer: acceptedOffer
                    // acceptedOffers: offers.map((offer) => {
                    //     return {
                    //         ticket_type: offer.ticket_type,
                    //         watcher_name: offer.watcher_name
                    //     };
                    // })
                }
            })({
                action: new cinerino.repository.Action(mongoose.connection),
                movieTicket: new cinerino.repository.paymentMethod.MovieTicket({
                    endpoint: '', // ムビチケ使用しないのでこれで問題ない
                    auth: mvtkReserveAuthClient
                }),
                project: new cinerino.repository.Project(mongoose.connection),
                seller: new cinerino.repository.Seller(mongoose.connection),
                transaction: new cinerino.repository.Transaction(mongoose.connection),
                event: new cinerino.repository.Event(mongoose.connection)
            });

            res.status(CREATED)
                .json(action);
        } catch (error) {
            next(error);
        }
    }
);

/**
 * 座席仮予約削除
 * @deprecated Use /transactions/PlaceOrder/:transactionId/actions/authorize/offer/seatReservation/:actionId/cancel
 */
placeOrderTransactionsRouter.delete(
    '/:transactionId/actions/authorize/seatReservation/:actionId',
    permitScopes(['transactions', 'pos']),
    validator,
    async (req, res, next) => {
        try {
            await cinerino.service.offer.seatReservation.cancel({
                project: req.project,
                agent: { id: req.user.sub },
                transaction: { id: req.params.transactionId },
                id: req.params.actionId
            })({
                action: new cinerino.repository.Action(mongoose.connection),
                project: new cinerino.repository.Project(mongoose.connection),
                transaction: new cinerino.repository.Transaction(mongoose.connection)
            });

            res.status(NO_CONTENT)
                .end();
        } catch (error) {
            next(error);
        }
    }
);

export default placeOrderTransactionsRouter;
