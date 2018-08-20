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
 * 予約ルーター
 */
const cinerino = require("@cinerino/domain");
const express_1 = require("express");
const jwt = require("jsonwebtoken");
// import authentication from '../middlewares/authentication';
// import permitScopes from '../middlewares/permitScopes';
const validator_1 = require("../middlewares/validator");
const reservationsRouter = express_1.Router();
// reservationsRouter.use(authentication);
const chevreAuthClient = new cinerino.chevre.auth.ClientCredentials({
    domain: process.env.CHEVRE_AUTHORIZE_SERVER_DOMAIN,
    clientId: process.env.CHEVRE_CLIENT_ID,
    clientSecret: process.env.CHEVRE_CLIENT_SECRET,
    scopes: [],
    state: ''
});
/**
 * トークンで予約照会
 */
reservationsRouter.post('/eventReservation/screeningEvent/findByToken', 
// permitScopes(['aws.cognito.signin.user.admin', 'orders', 'orders.read-only']),
(req, _, next) => {
    req.checkBody('token', 'invalid token').notEmpty().withMessage('token is required');
    next();
}, validator_1.default, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const token = req.body.token;
        const payload = yield new Promise((resolve, reject) => {
            jwt.verify(token, process.env.TOKEN_SECRET, {}, (err, decoded) => {
                if (err instanceof Error) {
                    reject(err);
                }
                else {
                    resolve(decoded);
                }
            });
        });
        const ownershipInfoRepo = new cinerino.repository.OwnershipInfo(cinerino.mongoose.connection);
        const ownershipInfo = yield ownershipInfoRepo.search({
            goodType: cinerino.factory.chevre.reservationType.EventReservation,
            identifier: payload.identifier
        }).then((infos) => {
            if (infos.length === 0) {
                throw new cinerino.factory.errors.NotFound('OwnershipInfo');
            }
            return infos[0];
        });
        const reservationService = new cinerino.chevre.service.Reservation({
            endpoint: process.env.CHEVRE_ENDPOINT,
            auth: chevreAuthClient
        });
        const reservations = yield reservationService.searchScreeningEventReservations({
            ids: [ownershipInfo.typeOfGood.id]
        });
        res.json(Object.assign({}, ownershipInfo, { typeOfGood: reservations[0] }));
    }
    catch (error) {
        next(error);
    }
}));
exports.default = reservationsRouter;
