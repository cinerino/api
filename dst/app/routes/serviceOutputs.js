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
 * サービスアウトプットルーター
 */
const cinerino = require("@cinerino/domain");
const express_1 = require("express");
// import { query } from 'express-validator';
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
const serviceOutputsRouter = express_1.Router();
/**
 * 検索
 */
serviceOutputsRouter.get('', permitScopes_1.default(['serviceOutputs.*', 'serviceOutputs.read']), rateLimit_1.default, ...[
// query('typeOf')
//     .not()
//     .isEmpty()
], validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const projectRepo = new cinerino.repository.Project(mongoose.connection);
        const project = yield projectRepo.findById({ id: req.project.id });
        if (((_a = project.settings) === null || _a === void 0 ? void 0 : _a.chevre) === undefined) {
            throw new cinerino.factory.errors.ServiceUnavailable('Project settings not satisfied');
        }
        const searchConditions = Object.assign(Object.assign({}, req.query), { project: { id: { $eq: req.project.id } }, 
            // tslint:disable-next-line:no-magic-numbers
            limit: (req.query.limit !== undefined) ? Math.min(req.query.limit, 100) : undefined, page: (req.query.page !== undefined) ? Math.max(req.query.page, 1) : undefined });
        const serviceOutputService = new cinerino.chevre.service.ServiceOutput({
            endpoint: project.settings.chevre.endpoint,
            auth: chevreAuthClient
        });
        const { data } = yield serviceOutputService.search(searchConditions);
        res.json(data);
    }
    catch (error) {
        next(error);
    }
}));
exports.default = serviceOutputsRouter;
