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
 * 販売者ルーター
 */
const cinerino = require("@cinerino/domain");
const express_1 = require("express");
const permitScopes_1 = require("../middlewares/permitScopes");
const rateLimit_1 = require("../middlewares/rateLimit");
const validator_1 = require("../middlewares/validator");
const chevreAuthClient = new cinerino.chevre.auth.ClientCredentials({
    domain: process.env.CHEVRE_AUTHORIZE_SERVER_DOMAIN,
    clientId: process.env.CHEVRE_CLIENT_ID,
    clientSecret: process.env.CHEVRE_CLIENT_SECRET,
    scopes: [],
    state: ''
});
const USE_LEGACY_SELLERS_SEARCH = process.env.USE_LEGACY_SELLERS_SEARCH === '1';
const sellersRouter = express_1.Router();
/**
 * 販売者検索
 */
sellersRouter.get('', permitScopes_1.default(['sellers.*', 'sellers.read', 'pos']), rateLimit_1.default, validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const sellerService = new cinerino.chevre.service.Seller({
            endpoint: cinerino.credentials.chevre.endpoint,
            auth: chevreAuthClient
        });
        if (!USE_LEGACY_SELLERS_SEARCH) {
            // location.branchCodesをadditionalPropertyに自動変換
            const locationBranchCodes = (_a = req.query.location) === null || _a === void 0 ? void 0 : _a.branchCodes;
            if (Array.isArray(locationBranchCodes)) {
                req.query.additionalProperty = Object.assign(Object.assign({}, req.query.additionalProperty), { $in: locationBranchCodes.map((branchCode) => {
                        return { name: 'branchCode', value: String(branchCode) };
                    }) });
                req.query.location.branchCodes = undefined;
            }
        }
        const { data } = yield sellerService.search(Object.assign(Object.assign(Object.assign({}, req.query), { project: { id: { $eq: req.project.id } } }), (!req.isAdmin)
            ? {
                $projection: {
                    'paymentAccepted.gmoInfo.shopPass': 0,
                    'paymentAccepted.movieTicketInfo': 0
                }
            }
            : undefined));
        res.json(data.map(addLocation));
    }
    catch (error) {
        next(error);
    }
}));
/**
 * IDで販売者検索
 */
sellersRouter.get('/:id', permitScopes_1.default(['sellers.*', 'sellers.read']), rateLimit_1.default, validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const sellerService = new cinerino.chevre.service.Seller({
            endpoint: cinerino.credentials.chevre.endpoint,
            auth: chevreAuthClient
        });
        const seller = yield sellerService.findById(Object.assign({ id: req.params.id }, (!req.isAdmin)
            ? {
                $projection: {
                    'paymentAccepted.gmoInfo.shopPass': 0,
                    'paymentAccepted.movieTicketInfo': 0
                }
            }
            : undefined));
        res.json(addLocation(seller));
    }
    catch (error) {
        next(error);
    }
}));
/**
 * ssktsへの互換性維持対応として、location属性を自動保管
 */
function addLocation(params) {
    var _a, _b;
    const seller = Object.assign({}, params);
    const branchCode = (_b = (_a = params.additionalProperty) === null || _a === void 0 ? void 0 : _a.find((p) => p.name === 'branchCode')) === null || _b === void 0 ? void 0 : _b.value;
    if (typeof branchCode === 'string') {
        seller.location = { project: seller.project, typeOf: cinerino.factory.chevre.placeType.MovieTheater, branchCode };
    }
    return seller;
}
exports.default = sellersRouter;
