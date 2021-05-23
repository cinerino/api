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
// import { body } from 'express-validator';
// import { CREATED, NO_CONTENT } from 'http-status';
// import * as mongoose from 'mongoose';
const permitScopes_1 = require("../middlewares/permitScopes");
const rateLimit_1 = require("../middlewares/rateLimit");
const validator_1 = require("../middlewares/validator");
// import { RoleName } from '../iam';
const chevreAuthClient = new cinerino.chevre.auth.ClientCredentials({
    domain: process.env.CHEVRE_AUTHORIZE_SERVER_DOMAIN,
    clientId: process.env.CHEVRE_CLIENT_ID,
    clientSecret: process.env.CHEVRE_CLIENT_SECRET,
    scopes: [],
    state: ''
});
const ADMIN_USER_POOL_ID = process.env.ADMIN_USER_POOL_ID;
const RESOURCE_SERVER_IDENTIFIER = process.env.RESOURCE_SERVER_IDENTIFIER;
// const TOKEN_ISSUERS_AS_ADMIN: string[] = (typeof process.env.TOKEN_ISSUERS_AS_ADMIN === 'string')
//     ? process.env.TOKEN_ISSUERS_AS_ADMIN.split(',')
//     : [];
const projectsRouter = express_1.Router();
/**
 * プロジェクト検索
 * 閲覧権限を持つプロジェクトを検索
 */
projectsRouter.get('', 
// permitScopes([]),
rateLimit_1.default, validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const meService = new cinerino.chevre.service.Me({
            endpoint: cinerino.credentials.chevre.endpoint,
            auth: req.chevreAuthClient,
            project: { id: '' }
        });
        const { data } = yield meService.searchProjects(Object.assign({}, req.query));
        res.json(data);
        // const memberRepo = new cinerino.repository.Member(mongoose.connection);
        // const projectService = new cinerino.chevre.service.Project({
        //     endpoint: cinerino.credentials.chevre.endpoint,
        //     auth: chevreAuthClient,
        //     project: { id: '' }
        // });
        // // tslint:disable-next-line:no-magic-numbers
        // const limit = (req.query.limit !== undefined) ? Math.min(req.query.limit, 100) : 100;
        // const page = (req.query.page !== undefined) ? Math.max(req.query.page, 1) : 1;
        // // 権限を持つプロジェクト検索
        // let searchConditions: any;
        // if (TOKEN_ISSUERS_AS_ADMIN.includes(req.user.iss)) {
        //     // 管理ユーザープールのクライアントであればreq.user.subとして検索
        //     searchConditions = {
        //         'member.id': { $eq: req.user.sub }
        //     };
        // } else {
        //     // それ以外であればreq.user.client_idとして検索
        //     searchConditions = {
        //         'member.id': { $eq: req.user.client_id }
        //     };
        // }
        // const projectMembers = await memberRepo.memberModel.find(
        //     searchConditions,
        //     { project: 1 }
        // )
        //     .limit(limit)
        //     .skip(limit * (page - 1))
        //     .setOptions({ maxTimeMS: 10000 })
        //     .exec()
        //     .then((docs) => docs.map((doc) => doc.toObject()));
        // let projectIds = projectMembers.map((m) => m.project.id);
        // // length=1だとidsの指定がない検索になってしまうので、ありえないプロジェクトIDで保管
        // if (projectIds.length === 0) {
        //     projectIds = ['***NoProjects***'];
        // }
        // const searchResult = await projectService.search(
        //     {
        //         ids: projectIds,
        //         limit: limit,
        //         $projection: { settings: 0 }
        //     }
        // );
        // res.json(searchResult.data);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * プロジェクト取得
 */
projectsRouter.get('/:id', permitScopes_1.default(['projects.*', 'projects.read']), rateLimit_1.default, validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const projectService = new cinerino.chevre.service.Project({
            endpoint: cinerino.credentials.chevre.endpoint,
            auth: chevreAuthClient,
            project: { id: '' }
        });
        const projection = (req.memberPermissions.indexOf(`${RESOURCE_SERVER_IDENTIFIER}/projects.settings.read`) >= 0)
            ? undefined
            : { settings: 0 };
        const project = yield projectService.findById(Object.assign({ id: req.project.id }, (projection !== undefined) ? { $projection: projection } : undefined));
        res.json(Object.assign(Object.assign({}, project), (project.settings !== undefined)
            ? {
                settings: Object.assign(Object.assign({}, project.settings), { cognito: Object.assign(Object.assign({}, (_a = project.settings) === null || _a === void 0 ? void 0 : _a.cognito), { 
                        // 互換性維持対応として
                        adminUserPool: { id: ADMIN_USER_POOL_ID } }) })
            }
            : undefined));
    }
    catch (error) {
        next(error);
    }
}));
/**
 * プロジェクト設定取得
 */
// projectsRouter.get(
//     '/:id/settings',
//     permitScopes(['projects.*', 'projects.settings.read']),
//     rateLimit,
//     validator,
//     async (req, res, next) => {
//         try {
//             const projectService = new cinerino.chevre.service.Project({
//                 endpoint: cinerino.credentials.chevre.endpoint,
//                 auth: chevreAuthClient,
//                 project: { id: '' }
//             });
//             const project = await projectService.findById({ id: req.project.id });
//             res.json({
//                 ...project.settings,
//                 cognito: {
//                     ...project.settings?.cognito,
//                     // 互換性維持対応として
//                     adminUserPool: { id: ADMIN_USER_POOL_ID }
//                 }
//             });
//         } catch (error) {
//             next(error);
//         }
//     }
// );
exports.default = projectsRouter;
