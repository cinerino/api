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
// import * as redis from '../../../../redis';
const chevreAuthClient = new cinerino.chevre.auth.ClientCredentials({
    domain: process.env.CHEVRE_AUTHORIZE_SERVER_DOMAIN,
    clientId: process.env.CHEVRE_CLIENT_ID,
    clientSecret: process.env.CHEVRE_CLIENT_SECRET,
    scopes: [],
    state: ''
});
const mvtkReserveAuthClient = new cinerino.mvtkreserveapi.auth.ClientCredentials({
    domain: process.env.MVTK_RESERVE_AUTHORIZE_SERVER_DOMAIN,
    clientId: process.env.MVTK_RESERVE_CLIENT_ID,
    clientSecret: process.env.MVTK_RESERVE_CLIENT_SECRET,
    scopes: [],
    state: ''
});
/**
 * 座席仮予約
 */
placeOrderTransactionsRouter.post('/:transactionId/actions/authorize/seatReservation', permitScopes_1.default(['transactions', 'pos']), validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const projectRepo = new cinerino.repository.Project(mongoose.connection);
        if (!Array.isArray(req.body.offers)) {
            req.body.offers = [];
        }
        const eventId = req.body.performance_id;
        const offers = req.body.offers;
        // チケットオファー検索
        const project = yield projectRepo.findById({ id: req.project.id });
        if (project.settings === undefined
            || project.settings.chevre === undefined) {
            throw new cinerino.factory.errors.ServiceUnavailable('Project settings undefined');
        }
        const eventService = new cinerino.chevre.service.Event({
            endpoint: project.settings.chevre.endpoint,
            auth: chevreAuthClient
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
                        typeOf: cinerino.factory.chevre.reservationType.EventReservation,
                        additionalTicketText: offer.watcher_name // 予約メモ
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
                endpoint: '',
                auth: mvtkReserveAuthClient
            }),
            project: new cinerino.repository.Project(mongoose.connection),
            seller: new cinerino.repository.Seller(mongoose.connection),
            transaction: new cinerino.repository.Transaction(mongoose.connection),
            event: new cinerino.repository.Event(mongoose.connection)
        });
        res.status(http_status_1.CREATED)
            .json(action);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * 座席仮予約削除
 * @deprecated Use /transactions/PlaceOrder/:transactionId/actions/authorize/offer/seatReservation/:actionId/cancel
 */
placeOrderTransactionsRouter.delete('/:transactionId/actions/authorize/seatReservation/:actionId', permitScopes_1.default(['transactions', 'pos']), validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield cinerino.service.offer.seatReservation.cancel({
            project: req.project,
            agent: { id: req.user.sub },
            transaction: { id: req.params.transactionId },
            id: req.params.actionId
        })({
            action: new cinerino.repository.Action(mongoose.connection),
            project: new cinerino.repository.Project(mongoose.connection),
            transaction: new cinerino.repository.Transaction(mongoose.connection)
        });
        res.status(http_status_1.NO_CONTENT)
            .end();
    }
    catch (error) {
        next(error);
    }
}));
exports.default = placeOrderTransactionsRouter;
