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
 * 場所ルーター
 */
const cinerino = require("@cinerino/domain");
const express_1 = require("express");
const permitScopes_1 = require("../middlewares/permitScopes");
const rateLimit_1 = require("../middlewares/rateLimit");
const validator_1 = require("../middlewares/validator");
// const chevreAuthClient = new cinerino.chevre.auth.ClientCredentials({
//     domain: <string>process.env.CHEVRE_AUTHORIZE_SERVER_DOMAIN,
//     clientId: <string>process.env.CHEVRE_CLIENT_ID,
//     clientSecret: <string>process.env.CHEVRE_CLIENT_SECRET,
//     scopes: [],
//     state: ''
// });
const placesRouter = express_1.Router();
placesRouter.get(`/${cinerino.factory.chevre.placeType.MovieTheater}`, permitScopes_1.default(['places.*', 'places.read']), rateLimit_1.default, validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const placeService = new cinerino.chevre.service.Place({
            endpoint: cinerino.credentials.chevre.endpoint,
            auth: req.chevreAuthClient,
            project: { id: req.project.id }
        });
        const { data } = yield placeService.searchMovieTheaters(Object.assign(Object.assign({}, req.query), { project: { ids: [req.project.id] } }));
        res.json(data);
    }
    catch (error) {
        error = cinerino.errorHandler.handleChevreError(error);
        next(error);
    }
}));
placesRouter.get(`/${cinerino.factory.chevre.placeType.ScreeningRoom}`, permitScopes_1.default(['places.*', 'places.read']), rateLimit_1.default, validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const placeService = new cinerino.chevre.service.Place({
            endpoint: cinerino.credentials.chevre.endpoint,
            auth: req.chevreAuthClient,
            project: { id: req.project.id }
        });
        const { data } = yield placeService.searchScreeningRooms(Object.assign(Object.assign({}, req.query), { project: { id: { $eq: req.project.id } } }));
        res.json(data);
    }
    catch (error) {
        error = cinerino.errorHandler.handleChevreError(error);
        next(error);
    }
}));
placesRouter.get(`/${cinerino.factory.chevre.placeType.Seat}`, permitScopes_1.default(['places.*', 'places.read']), rateLimit_1.default, validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const placeService = new cinerino.chevre.service.Place({
            endpoint: cinerino.credentials.chevre.endpoint,
            auth: req.chevreAuthClient,
            project: { id: req.project.id }
        });
        const { data } = yield placeService.searchSeats(Object.assign(Object.assign({}, req.query), { project: { id: { $eq: req.project.id } } }));
        res.json(data);
    }
    catch (error) {
        error = cinerino.errorHandler.handleChevreError(error);
        next(error);
    }
}));
exports.default = placesRouter;
