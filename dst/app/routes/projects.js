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
 * プロジェクトルーター
 */
const cinerino = require("@cinerino/domain");
const express_1 = require("express");
const mongoose = require("mongoose");
const permitScopes_1 = require("../middlewares/permitScopes");
const rateLimit_1 = require("../middlewares/rateLimit");
const validator_1 = require("../middlewares/validator");
const detail_1 = require("./projects/detail");
const projectsRouter = express_1.Router();
/**
 * プロジェクト検索
 */
projectsRouter.get('', permitScopes_1.default([]), rateLimit_1.default, validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const searchCoinditions = Object.assign(Object.assign({}, req.query), { 
            // tslint:disable-next-line:no-magic-numbers
            limit: (req.query.limit !== undefined) ? Math.min(req.query.limit, 100) : 100, page: (req.query.page !== undefined) ? Math.max(req.query.page, 1) : 1 });
        const projectRepo = new cinerino.repository.Project(mongoose.connection);
        const projects = yield projectRepo.search(searchCoinditions, undefined);
        const totalCount = yield projectRepo.count(searchCoinditions);
        res.set('X-Total-Count', totalCount.toString());
        res.json(projects);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * IDでプロジェクト検索
 */
projectsRouter.get('/:id', permitScopes_1.default([]), rateLimit_1.default, validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const projectRepo = new cinerino.repository.Project(mongoose.connection);
        const seller = yield projectRepo.findById({ id: req.params.id }, undefined);
        res.json(seller);
    }
    catch (error) {
        next(error);
    }
}));
projectsRouter.all('/:id/*', (req, _, next) => __awaiter(void 0, void 0, void 0, function* () {
    // プロジェクト指定ルーティング配下については、すべてreq.projectを上書き
    req.project = { typeOf: 'Project', id: req.params.id };
    next();
}));
projectsRouter.use('/:id', detail_1.default);
exports.default = projectsRouter;
