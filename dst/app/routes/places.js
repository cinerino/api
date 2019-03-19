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
const express_1 = require("express");
const placesRouter = express_1.Router();
const cinerino = require("@cinerino/domain");
// import * as mongoose from 'mongoose';
const authentication_1 = require("../middlewares/authentication");
const permitScopes_1 = require("../middlewares/permitScopes");
const validator_1 = require("../middlewares/validator");
placesRouter.use(authentication_1.default);
placesRouter.get('/movieTheater/:branchCode', permitScopes_1.default(['aws.cognito.signin.user.admin', 'places', 'places.read-only']), validator_1.default, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const movieTheater = cinerino.service.masterSync.createMovieTheaterFromCOA(yield cinerino.COA.services.master.theater({ theaterCode: req.params.branchCode }), yield cinerino.COA.services.master.screen({ theaterCode: req.params.branchCode }));
        res.json(movieTheater);
        // const repository = new cinerino.repository.Place(mongoose.connection);
        // await repository.findMovieTheaterByBranchCode(req.params.branchCode)
        //     .then((theater) => {
        //         res.json(theater);
        //     });
    }
    catch (error) {
        next(error);
    }
}));
// おそらく使用していないので削除
// もし使用していれば戻す
// placesRouter.get(
//     '/movieTheater',
//     permitScopes(['aws.cognito.signin.user.admin', 'places', 'places.read-only']),
//     validator,
//     async (__, res, next) => {
//         try {
//             const repository = new cinerino.repository.Place(mongoose.connection);
//             await repository.searchMovieTheaters({})
//                 .then((places) => {
//                     res.json(places);
//                 });
//         } catch (error) {
//             next(error);
//         }
//     }
// );
exports.default = placesRouter;
