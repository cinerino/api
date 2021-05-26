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
 * 顧客ルーター
 */
const cinerino = require("@cinerino/domain");
const express_1 = require("express");
const permitScopes_1 = require("../middlewares/permitScopes");
const rateLimit_1 = require("../middlewares/rateLimit");
const validator_1 = require("../middlewares/validator");
const customersRouter = express_1.Router();
/**
 * 顧客検索
 */
customersRouter.get('', permitScopes_1.default(['customers.*', 'customers.read']), rateLimit_1.default, validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const customerService = new cinerino.chevre.service.Customer({
            endpoint: cinerino.credentials.chevre.endpoint,
            auth: req.chevreAuthClient,
            project: { id: req.project.id }
        });
        const { data } = yield customerService.search(Object.assign(Object.assign({}, req.query), { project: { id: { $eq: req.project.id } } }));
        res.json(data);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * IDで顧客検索
 */
customersRouter.get('/:id', permitScopes_1.default(['customers.*', 'customers.read']), rateLimit_1.default, validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const customerService = new cinerino.chevre.service.Customer({
            endpoint: cinerino.credentials.chevre.endpoint,
            auth: req.chevreAuthClient,
            project: { id: req.project.id }
        });
        const customer = yield customerService.findById({ id: req.params.id });
        res.json(customer);
    }
    catch (error) {
        next(error);
    }
}));
exports.default = customersRouter;
