"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * 自分の予約ルーター
 */
const cinerino = require("@cinerino/domain");
const express_1 = require("express");
// import { CREATED, NO_CONTENT } from 'http-status';
const permitScopes_1 = require("../../../middlewares/permitScopes");
const validator_1 = require("../../../middlewares/validator");
// import * as redis from '../../../../redis';
const reservationsRouter = express_1.Router();
const chevreAuthClient = new cinerino.chevre.auth.ClientCredentials({
    domain: process.env.CHEVRE_AUTHORIZE_SERVER_DOMAIN,
    clientId: process.env.CHEVRE_CLIENT_ID,
    clientSecret: process.env.CHEVRE_CLIENT_SECRET,
    scopes: [],
    state: ''
});
/**
 * 上映イベント予約検索
 */
reservationsRouter.get('/eventReservation/screeningEvent', permitScopes_1.default(['aws.cognito.signin.user.admin', 'people.accounts.read-only']), validator_1.default, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const ownershipInfoRepo = new cinerino.repository.OwnershipInfo(cinerino.mongoose.connection);
        const reservationService = new cinerino.chevre.service.Reservation({
            endpoint: process.env.CHEVRE_ENDPOINT,
            auth: chevreAuthClient
        });
        const ownershipInfos = yield cinerino.service.reservation.searchScreeningEventReservations({
            personId: req.user.sub,
            ownedAt: new Date()
        })({
            ownershipInfo: ownershipInfoRepo,
            reservationService: reservationService
        });
        res.json(ownershipInfos);
    }
    catch (error) {
        next(error);
    }
}));
exports.default = reservationsRouter;
