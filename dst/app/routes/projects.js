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
const express_validator_1 = require("express-validator");
const http_status_1 = require("http-status");
const mongoose = require("mongoose");
const permitScopes_1 = require("../middlewares/permitScopes");
const rateLimit_1 = require("../middlewares/rateLimit");
const validator_1 = require("../middlewares/validator");
const iam_1 = require("../iam");
const chevreAuthClient = new cinerino.chevre.auth.ClientCredentials({
    domain: process.env.CHEVRE_AUTHORIZE_SERVER_DOMAIN,
    clientId: process.env.CHEVRE_CLIENT_ID,
    clientSecret: process.env.CHEVRE_CLIENT_SECRET,
    scopes: [],
    state: ''
});
const ADMIN_USER_POOL_ID = process.env.ADMIN_USER_POOL_ID;
const RESOURCE_SERVER_IDENTIFIER = process.env.RESOURCE_SERVER_IDENTIFIER;
const TOKEN_ISSUERS_AS_ADMIN = (typeof process.env.TOKEN_ISSUERS_AS_ADMIN === 'string')
    ? process.env.TOKEN_ISSUERS_AS_ADMIN.split(',')
    : [];
const projectsRouter = express_1.Router();
/**
 * プロジェクト作成
 * 同時に作成者はプロジェクトオーナーになります
 */
projectsRouter.post('', 
// permitScopes([]),
rateLimit_1.default, ...[
    express_validator_1.body('typeOf')
        .not()
        .isEmpty()
        .withMessage(() => 'required')
        .isString(),
    express_validator_1.body('name')
        .not()
        .isEmpty()
        .withMessage(() => 'required')
        .isString(),
    express_validator_1.body('id')
        .not()
        .isEmpty()
        .withMessage(() => 'required')
        .isString(),
    express_validator_1.body('logo')
        .not()
        .isEmpty()
        .withMessage(() => 'required')
        .isURL(),
    // body('parentOrganization.typeOf')
    //     .not()
    //     .isEmpty()
    //     .withMessage(() => 'required')
    //     .isString(),
    // body('parentOrganization.name.ja')
    //     .not()
    //     .isEmpty()
    //     .withMessage(() => 'required')
    //     .isString(),
    // body('parentOrganization.name.en')
    //     .not()
    //     .isEmpty()
    //     .withMessage(() => 'required')
    //     .isString(),
    express_validator_1.body('settings.cognito.customerUserPool.id')
        .not()
        .isEmpty()
        .withMessage(() => 'required')
        .isString()
], validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const memberRepo = new cinerino.repository.Member(mongoose.connection);
        const project = createFromBody(req.body);
        let member;
        const personRepo = new cinerino.repository.Person({
            userPoolId: ADMIN_USER_POOL_ID
        });
        const people = yield personRepo.search({ id: req.user.sub });
        if (people[0].memberOf === undefined) {
            throw new cinerino.factory.errors.NotFound('Administrator.memberOf');
        }
        member = {
            typeOf: people[0].typeOf,
            id: people[0].id,
            username: people[0].memberOf.membershipNumber,
            hasRole: [{
                    typeOf: 'OrganizationRole',
                    roleName: iam_1.RoleName.Owner,
                    memberOf: { typeOf: project.typeOf, id: project.id }
                }]
        };
        // プロジェクト作成
        // project = await projectRepo.projectModel.create({ ...project, _id: project.id })
        //     .then((doc) => doc.toObject());
        // 権限作成
        yield memberRepo.memberModel.create({
            project: { typeOf: project.typeOf, id: project.id },
            typeOf: 'OrganizationRole',
            member: member
        });
        // chevreでプロジェクト作成
        const projectService = new cinerino.chevre.service.Project({
            endpoint: cinerino.credentials.chevre.endpoint,
            auth: chevreAuthClient
        });
        yield projectService.create({
            typeOf: cinerino.factory.chevre.organizationType.Project,
            id: project.id,
            logo: project.logo,
            name: (typeof project.name === 'string') ? project.name : undefined,
            // parentOrganization: project.parentOrganization,
            settings: project.settings
        });
        res.status(http_status_1.CREATED)
            .json(project);
    }
    catch (error) {
        next(error);
    }
}));
function createFromBody(params) {
    var _a, _b, _c, _d, _e, _f;
    return {
        id: params.id,
        typeOf: params.typeOf,
        logo: params.logo,
        name: params.name,
        // parentOrganization: params.parentOrganization,
        settings: Object.assign({ cognito: {
                customerUserPool: {
                    id: (_c = (_b = (_a = params.settings) === null || _a === void 0 ? void 0 : _a.cognito) === null || _b === void 0 ? void 0 : _b.customerUserPool) === null || _c === void 0 ? void 0 : _c.id
                }
            }, onOrderStatusChanged: {
                informOrder: (Array.isArray((_e = (_d = params.settings) === null || _d === void 0 ? void 0 : _d.onOrderStatusChanged) === null || _e === void 0 ? void 0 : _e.informOrder))
                    ? params.settings.onOrderStatusChanged.informOrder
                    : []
            }, useUsernameAsGMOMemberId: false }, (typeof ((_f = params.settings) === null || _f === void 0 ? void 0 : _f.sendgridApiKey) === 'string' && params.settings.sendgridApiKey.length > 0)
            ? { sendgridApiKey: params.settings.sendgridApiKey }
            : undefined)
    };
}
/**
 * プロジェクト検索
 * 閲覧権限を持つプロジェクトを検索
 */
projectsRouter.get('', 
// permitScopes([]),
rateLimit_1.default, validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const memberRepo = new cinerino.repository.Member(mongoose.connection);
        const projectService = new cinerino.chevre.service.Project({
            endpoint: cinerino.credentials.chevre.endpoint,
            auth: chevreAuthClient
        });
        // tslint:disable-next-line:no-magic-numbers
        const limit = (req.query.limit !== undefined) ? Math.min(req.query.limit, 100) : 100;
        const page = (req.query.page !== undefined) ? Math.max(req.query.page, 1) : 1;
        // 権限を持つプロジェクト検索
        let searchConditions;
        if (TOKEN_ISSUERS_AS_ADMIN.includes(req.user.iss)) {
            // 管理ユーザープールのクライアントであればreq.user.subとして検索
            searchConditions = {
                'member.id': { $eq: req.user.sub }
            };
        }
        else {
            // それ以外であればreq.user.client_idとして検索
            searchConditions = {
                'member.id': { $eq: req.user.client_id }
            };
        }
        const projectMembers = yield memberRepo.memberModel.find(searchConditions, { project: 1 })
            .limit(limit)
            .skip(limit * (page - 1))
            .setOptions({ maxTimeMS: 10000 })
            .exec()
            .then((docs) => docs.map((doc) => doc.toObject()));
        let projectIds = projectMembers.map((m) => m.project.id);
        // length=1だとidsの指定がない検索になってしまうので、ありえないプロジェクトIDで保管
        if (projectIds.length === 0) {
            projectIds = ['***NoProjects***'];
        }
        const searchResult = yield projectService.search({
            ids: projectIds,
            limit: limit,
            $projection: { settings: 0 }
        });
        res.json(searchResult.data);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * プロジェクト検索
 */
// async function search(
//     conditions: cinerino.factory.project.ISearchConditions,
//     projection?: any
// ): Promise<cinerino.factory.project.IProject[]> {
//     const searchResult = await projectService.search({
//         ...conditions,
//         ...(projection !== undefined && projection !== null) ? { $projection: projection } : undefined
//     });
//     return searchResult.data;
// }
/**
 * プロジェクト取得
 */
projectsRouter.get('/:id', permitScopes_1.default(['projects.*', 'projects.read']), rateLimit_1.default, validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const projectService = new cinerino.chevre.service.Project({
            endpoint: cinerino.credentials.chevre.endpoint,
            auth: chevreAuthClient
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
 * プロジェクト更新
 */
projectsRouter.patch('/:id', permitScopes_1.default(['projects.*', 'projects.write']), rateLimit_1.default, ...[], validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _b, _c, _d, _e;
    try {
        const projectService = new cinerino.chevre.service.Project({
            endpoint: cinerino.credentials.chevre.endpoint,
            auth: chevreAuthClient
        });
        let project = yield projectService.findById({ id: req.project.id });
        project = Object.assign(Object.assign(Object.assign(Object.assign({}, project), (typeof req.body.name === 'string' && req.body.name.length > 0) ? { name: req.body.name } : undefined), (typeof req.body.logo === 'string' && req.body.logo.length > 0) ? { logo: req.body.logo } : undefined), { settings: Object.assign(Object.assign(Object.assign({}, project.settings), (typeof ((_b = req.body.settings) === null || _b === void 0 ? void 0 : _b.sendgridApiKey) === 'string')
                ? { sendgridApiKey: req.body.settings.sendgridApiKey }
                : undefined), { onOrderStatusChanged: Object.assign(Object.assign({}, (_c = project.settings) === null || _c === void 0 ? void 0 : _c.onOrderStatusChanged), (Array.isArray((_e = (_d = req.body.settings) === null || _d === void 0 ? void 0 : _d.onOrderStatusChanged) === null || _e === void 0 ? void 0 : _e.informOrder))
                    ? { informOrder: req.body.settings.onOrderStatusChanged.informOrder }
                    : undefined) }) });
        // const project = <cinerino.factory.project.IProject>await projectRepo.projectModel.findOneAndUpdate(
        //     { _id: req.project.id },
        //     {
        //         updatedAt: new Date(),
        //         ...(typeof req.body.name === 'string' && req.body.name.length > 0) ? { name: req.body.name } : undefined,
        //         ...(typeof req.body.logo === 'string' && req.body.logo.length > 0) ? { logo: req.body.logo } : undefined,
        //         ...(typeof req.body.settings?.sendgridApiKey === 'string')
        //             ? { 'settings.sendgridApiKey': req.body.settings.sendgridApiKey }
        //             : undefined,
        //         ...(Array.isArray(req.body.settings?.onOrderStatusChanged?.informOrder))
        //             ? { 'settings.onOrderStatusChanged.informOrder': req.body.settings.onOrderStatusChanged.informOrder }
        //             : undefined,
        //     },
        //     {
        //         new: true
        //     }
        // )
        //     .exec()
        //     .then((doc) => {
        //         if (doc === null) {
        //             throw new cinerino.factory.errors.NotFound('Project');
        //         }
        //         return doc.toObject();
        //     });
        // chevre連携
        yield projectService.update({
            typeOf: cinerino.factory.chevre.organizationType.Project,
            id: project.id,
            logo: project.logo,
            name: (typeof project.name === 'string') ? project.name : undefined,
            settings: project.settings
        });
        res.status(http_status_1.NO_CONTENT)
            .end();
    }
    catch (error) {
        next(error);
    }
}));
/**
 * プロジェクト設定取得
 */
projectsRouter.get('/:id/settings', permitScopes_1.default(['projects.*', 'projects.settings.read']), rateLimit_1.default, validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _f;
    try {
        const projectService = new cinerino.chevre.service.Project({
            endpoint: cinerino.credentials.chevre.endpoint,
            auth: chevreAuthClient
        });
        const project = yield projectService.findById({ id: req.project.id });
        res.json(Object.assign(Object.assign({}, project.settings), { cognito: Object.assign(Object.assign({}, (_f = project.settings) === null || _f === void 0 ? void 0 : _f.cognito), { 
                // 互換性維持対応として
                adminUserPool: { id: ADMIN_USER_POOL_ID } }) }));
    }
    catch (error) {
        next(error);
    }
}));
exports.default = projectsRouter;
