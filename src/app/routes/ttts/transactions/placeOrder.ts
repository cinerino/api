/**
 * 注文取引ルーター(ttts専用)
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';
import { CREATED } from 'http-status';
import * as mongoose from 'mongoose';

const placeOrderTransactionsRouter = Router();

import permitScopes from '../../../middlewares/permitScopes';
import validator from '../../../middlewares/validator';

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

export interface IAcceptedOffer4ttts {
    /**
     * オファーコード(オファーIDではない)
     */
    ticket_type?: string;
    /**
     * 予約メモ
     */
    watcher_name?: string;
}

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

            const eventId: string = req.body.performance_id;
            const offers: IAcceptedOffer4ttts[] = req.body.offers;

            // チケットオファー検索
            const eventService = new cinerino.chevre.service.Event({
                endpoint: cinerino.credentials.chevre.endpoint,
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
                        id: <string>ticketOffer.id, // オファーID
                        itemOffered: {
                            serviceOutput: {
                                typeOf: cinerino.factory.chevre.reservationType.EventReservation,
                                additionalTicketText: (typeof offer.watcher_name === 'string') ? offer.watcher_name : ''
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
                }
            })({
                action: new cinerino.repository.Action(mongoose.connection),
                movieTicket: new cinerino.repository.paymentMethod.MovieTicket({
                    endpoint: '', // ムビチケ使用しないのでこれで問題ない
                    auth: mvtkReserveAuthClient
                }),
                project: new cinerino.repository.Project(mongoose.connection),
                transaction: new cinerino.repository.Transaction(mongoose.connection)
            });

            res.status(CREATED)
                .json(action);
        } catch (error) {
            next(error);
        }
    }
);

export default placeOrderTransactionsRouter;
