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
 * @deprecated フロントエンドが使用を停止し次第、廃止
 */
const express_1 = require("express");
const placesRouter = express_1.Router();
const cinerino = require("@cinerino/domain");
const google_libphonenumber_1 = require("google-libphonenumber");
const mongoose = require("mongoose");
const authentication_1 = require("../middlewares/authentication");
const permitScopes_1 = require("../middlewares/permitScopes");
const validator_1 = require("../middlewares/validator");
placesRouter.use(authentication_1.default);
placesRouter.get('/movieTheater/:branchCode', permitScopes_1.default(['customer', 'places', 'places.read-only']), validator_1.default, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        // const movieTheater = cinerino.service.masterSync.createMovieTheaterFromCOA(
        //     await cinerino.COA.services.master.theater({ theaterCode: req.params.branchCode }),
        //     await cinerino.COA.services.master.screen({ theaterCode: req.params.branchCode })
        // );
        const sellerRepo = new cinerino.repository.Seller(mongoose.connection);
        const sellers = yield sellerRepo.search({
            limit: 1,
            location: { branchCodes: [req.params.branchCode] }
        });
        const seller = sellers.shift();
        if (seller === undefined) {
            throw new cinerino.factory.errors.NotFound('Seller');
        }
        if (seller.location === undefined) {
            throw new cinerino.factory.errors.NotFound('Seller Location');
        }
        const phoneUtil = google_libphonenumber_1.PhoneNumberUtil.getInstance();
        const phoneNumber = phoneUtil.parse(seller.telephone);
        const movieTheater = Object.assign({}, seller.location, { telephone: phoneUtil.format(phoneNumber, google_libphonenumber_1.PhoneNumberFormat.NATIONAL) });
        res.json(movieTheater);
    }
    catch (error) {
        next(error);
    }
}));
// おそらく使用していないので削除
// もし使用していれば戻す
// placesRouter.get(
//     '/movieTheater',
//     permitScopes(['customer', 'places', 'places.read-only']),
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
