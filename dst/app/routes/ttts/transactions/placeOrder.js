"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * 注文取引ルーター(ttts専用)
 */
const cinerino = require("@cinerino/domain");
const express_1 = require("express");
const http_status_1 = require("http-status");
const mongoose = require("mongoose");
const placeOrderTransactionsRouter = express_1.Router();
const permitScopes_1 = require("../../../middlewares/permitScopes");
const validator_1 = require("../../../middlewares/validator");
/**
 * 座席仮予約
 */
placeOrderTransactionsRouter.post('/:transactionId/actions/authorize/seatReservation', permitScopes_1.default(['transactions']), validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!Array.isArray(req.body.offers)) {
            req.body.offers = [];
        }
        const eventId = req.body.performance_id;
        const offers = req.body.offers;
        // チケットオファー検索
        const eventService = new cinerino.chevre.service.Event({
            endpoint: cinerino.credentials.chevre.endpoint,
            auth: req.chevreAuthClient,
            project: { id: req.project.id }
        });
        const ticketOffers = yield eventService.searchTicketOffers({ id: eventId });
        // Cinerino本家のacceptedOfferへ変換
        const acceptedOffer = offers.map((offer) => {
            const ticketOffer = ticketOffers.find((t) => t.identifier === offer.ticket_type);
            if (ticketOffer === undefined) {
                throw new cinerino.factory.errors.NotFound('Offer', `Offer ${offer.ticket_type} not found`);
            }
            return {
                id: ticketOffer.id,
                itemOffered: {
                    serviceOutput: {
                        typeOf: cinerino.factory.reservationType.EventReservation,
                        additionalTicketText: (typeof offer.watcher_name === 'string') ? offer.watcher_name : ''
                    }
                },
                additionalProperty: []
            };
        });
        const action = yield cinerino.service.offer.seatReservation.create({
            autoSeatSelection: true,
            project: req.project,
            agent: { id: req.user.sub },
            transaction: { id: req.params.transactionId },
            object: Object.assign({ reservationFor: { id: eventId }, acceptedOffer: acceptedOffer }, (req.isProjectMember) ? { broker: req.agent } : undefined)
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
        res.status(http_status_1.CREATED)
            .json(action);
    }
    catch (error) {
        next(error);
    }
}));
exports.default = placeOrderTransactionsRouter;
