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
    permitScopes(['transactions']),
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
                auth: req.chevreAuthClient,
                project: { id: req.project.id }
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
                                typeOf: cinerino.factory.reservationType.EventReservation,
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
                    reservationFor: { id: eventId },
                    acceptedOffer: acceptedOffer,
                    ...(req.isAdmin) ? { broker: <any>req.agent } : undefined
                }
            })({
                action: new cinerino.repository.Action(mongoose.connection),
                event: eventService,
                seller: new cinerino.chevre.service.Seller({
                    endpoint: cinerino.credentials.chevre.endpoint,
                    auth: req.chevreAuthClient,
                    project: { id: req.project.id }
                }),
                transaction: new cinerino.repository.Transaction(mongoose.connection),
                transactionNumber: new cinerino.chevre.service.TransactionNumber({
                    endpoint: cinerino.credentials.chevre.endpoint,
                    auth: req.chevreAuthClient,
                    project: { id: req.project.id }
                })
            });

            res.status(CREATED)
                .json(action);
        } catch (error) {
            next(error);
        }
    }
);

export default placeOrderTransactionsRouter;
