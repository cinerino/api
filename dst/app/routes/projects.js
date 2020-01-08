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
const setMemberPermissions_1 = require("../middlewares/setMemberPermissions");
const validator_1 = require("../middlewares/validator");
const projectsRouter = express_1.Router();
/**
 * プロジェクト検索
 * 閲覧権限を持つプロジェクトを検索
 */
projectsRouter.get('', 
// permitScopes([]),
rateLimit_1.default, validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const memberRepo = new cinerino.repository.Member(mongoose.connection);
        const projectRepo = new cinerino.repository.Project(mongoose.connection);
        // tslint:disable-next-line:no-magic-numbers
        const limit = (req.query.limit !== undefined) ? Math.min(req.query.limit, 100) : 100;
        const page = (req.query.page !== undefined) ? Math.max(req.query.page, 1) : 1;
        // 権限を持つプロジェクト検索
        const searchCoinditions = {
            'member.id': req.user.sub
        };
        const totalCount = yield memberRepo.memberModel.countDocuments(searchCoinditions)
            .setOptions({ maxTimeMS: 10000 })
            .exec();
        const projectMembers = yield memberRepo.memberModel.find(searchCoinditions, { project: 1 })
            .limit(limit)
            .skip(limit * (page - 1))
            .setOptions({ maxTimeMS: 10000 })
            .exec()
            .then((docs) => docs.map((doc) => doc.toObject()));
        const projects = yield projectRepo.search({
            ids: projectMembers.map((m) => m.project.id),
            limit: limit
        }, { settings: 0 });
        // const totalCount = await projectRepo.count(searchCoinditions);
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
projectsRouter.get('/:id', (req, _, next) => {
    req.project = { typeOf: cinerino.factory.organizationType.Project, id: req.params.id };
    next();
}, setMemberPermissions_1.default, permitScopes_1.default(['projects.*', 'projects.read']), rateLimit_1.default, validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const memberRepo = new cinerino.repository.Member(mongoose.connection);
        const projectRepo = new cinerino.repository.Project(mongoose.connection);
        // 権限を持つプロジェクト検索
        const searchCoinditions = {
            'project.id': req.params.id,
            'member.id': req.user.sub
        };
        const projectMember = yield memberRepo.memberModel.findOne(searchCoinditions, { project: 1 })
            .setOptions({ maxTimeMS: 10000 })
            .exec();
        if (projectMember === null) {
            throw new cinerino.factory.errors.NotFound('Project');
        }
        const projection = (req.memberPermissions.indexOf('projects.settings.read') >= 0) ? undefined : { settings: 0 };
        const project = yield projectRepo.findById({ id: req.params.id }, projection);
        res.json(project);
    }
    catch (error) {
        next(error);
    }
}));
exports.default = projectsRouter;
