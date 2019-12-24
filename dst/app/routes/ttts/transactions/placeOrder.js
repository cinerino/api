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
/**
 * 座席仮予約
 */
placeOrderTransactionsRouter.post('/:transactionId/actions/authorize/seatReservation', permitScopes_1.default(['transactions', 'pos']), validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!Array.isArray(req.body.offers)) {
            req.body.offers = [];
        }
        const performanceId = req.body.performance_id;
        const action = yield cinerino.service.offer.seatReservation4ttts.create({
            project: req.project,
            agent: { id: req.user.sub },
            transaction: { id: req.params.transactionId },
            object: {
                event: { id: performanceId },
                acceptedOffer: [],
                acceptedOffers: req.body.offers.map((offer) => {
                    return {
                        ticket_type: offer.ticket_type,
                        watcher_name: offer.watcher_name
                    };
                })
            }
        })(new cinerino.repository.Action(mongoose.connection), 
        // new cinerino.repository.rateLimit.TicketTypeCategory(redis.getClient()),
        new cinerino.repository.Transaction(mongoose.connection), new cinerino.repository.Project(mongoose.connection));
        res.status(http_status_1.CREATED)
            .json(action);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * 座席仮予約削除
 */
placeOrderTransactionsRouter.delete('/:transactionId/actions/authorize/seatReservation/:actionId', permitScopes_1.default(['transactions', 'pos']), validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield cinerino.service.offer.seatReservation4ttts.cancel({
            project: req.project,
            agent: { id: req.user.sub },
            transaction: { id: req.params.transactionId },
            id: req.params.actionId
        })(new cinerino.repository.Transaction(mongoose.connection), new cinerino.repository.Action(mongoose.connection), 
        // new cinerino.repository.rateLimit.TicketTypeCategory(redis.getClient()),
        new cinerino.repository.Project(mongoose.connection));
        res.status(http_status_1.NO_CONTENT)
            .end();
    }
    catch (error) {
        next(error);
    }
}));
exports.default = placeOrderTransactionsRouter;
