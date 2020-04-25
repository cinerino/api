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
const programMembershipsRouter = express_1.Router();
/**
 * 会員プログラム検索
 */
programMembershipsRouter.get('', permitScopes_1.default(['programMemberships.*', 'programMemberships.read']), rateLimit_1.default, validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const programMembershipRepo = new cinerino.repository.ProgramMembership(mongoose.connection);
        const searchConditions = Object.assign(Object.assign({}, req.query), { project: { id: { $eq: req.project.id } }, 
            // tslint:disable-next-line:no-magic-numbers
            limit: (req.query.limit !== undefined) ? Math.min(req.query.limit, 100) : 100, page: (req.query.page !== undefined) ? Math.max(req.query.page, 1) : 1 });
        let programMemberships = yield programMembershipRepo.search(searchConditions);
        // api使用側への互換性維持のため、price属性を補完
        programMemberships = programMemberships.map((p) => {
            var _a;
            const offers = (_a = p.offers) === null || _a === void 0 ? void 0 : _a.map((o) => {
                var _a;
                return Object.assign(Object.assign({}, o), { price: (_a = o.priceSpecification) === null || _a === void 0 ? void 0 : _a.price });
            });
            return Object.assign(Object.assign({}, p), (Array.isArray(offers)) ? { offers } : undefined);
        });
        res.json(programMemberships);
    }
    catch (error) {
        next(error);
    }
}));
exports.default = programMembershipsRouter;
