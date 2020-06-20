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
 * 会員プログラムルーター
 */
const cinerino = require("@cinerino/domain");
const express_1 = require("express");
const mongoose = require("mongoose");
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
const programMembershipsRouter = express_1.Router();
/**
 * 会員プログラム検索
 * @deprecated ssktsでのみ仕様可能
 */
programMembershipsRouter.get('', permitScopes_1.default(['programMemberships.*', 'programMemberships.read', 'products.*', 'products.read']), rateLimit_1.default, validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        const projectRepo = new cinerino.repository.Project(mongoose.connection);
        const project = yield projectRepo.findById({ id: req.project.id });
        if (typeof ((_b = (_a = project.settings) === null || _a === void 0 ? void 0 : _a.chevre) === null || _b === void 0 ? void 0 : _b.endpoint) !== 'string') {
            throw new cinerino.factory.errors.ServiceUnavailable('Project settings not satisfied');
        }
        const productService = new cinerino.chevre.service.Product({
            endpoint: project.settings.chevre.endpoint,
            auth: chevreAuthClient
        });
        const searchResult = yield productService.search(Object.assign({ project: { id: { $eq: req.project.id } }, typeOf: { $eq: cinerino.service.offer.product.ProductType.MembershipService } }, {
            limit: 1
        }));
        let membershipServices = searchResult.data;
        // api使用側への互換性維持のため、offers属性を補完
        membershipServices = membershipServices.map((m) => {
            return Object.assign(Object.assign({}, m), { offers: [
                    {
                        project: m.project,
                        typeOf: cinerino.factory.chevre.offerType.Offer,
                        identifier: 'AnnualPlan',
                        price: 500,
                        priceCurrency: cinerino.factory.chevre.priceCurrency.JPY
                    }
                ] });
        });
        res.json(membershipServices);
    }
    catch (error) {
        next(error);
    }
}));
exports.default = programMembershipsRouter;
