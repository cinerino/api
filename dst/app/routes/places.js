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
 * 場所ルーター
 */
const cinerino = require("@cinerino/domain");
const express_1 = require("express");
const placesRouter = express_1.Router();
const authentication_1 = require("../middlewares/authentication");
const permitScopes_1 = require("../middlewares/permitScopes");
const validator_1 = require("../middlewares/validator");
placesRouter.use(authentication_1.default);
placesRouter.get('/movieTheater/:branchCode', permitScopes_1.default(['aws.cognito.signin.user.admin', 'places', 'places.read-only']), validator_1.default, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const repository = new cinerino.repository.Place(cinerino.mongoose.connection);
        yield repository.findMovieTheaterByBranchCode(req.params.branchCode).then((theater) => {
            res.json(theater);
        });
    }
    catch (error) {
        next(error);
    }
}));
placesRouter.get('/movieTheater', permitScopes_1.default(['aws.cognito.signin.user.admin', 'places', 'places.read-only']), validator_1.default, (__, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const repository = new cinerino.repository.Place(cinerino.mongoose.connection);
        yield repository.searchMovieTheaters({}).then((places) => {
            res.json(places);
        });
    }
    catch (error) {
        next(error);
    }
}));
exports.default = placesRouter;
