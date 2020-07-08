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
const RESOURCE_SERVER_IDENTIFIER = process.env.RESOURCE_SERVER_IDENTIFIER;
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
    express_validator_1.body('parentOrganization.typeOf')
        .not()
        .isEmpty()
        .withMessage(() => 'required')
        .isString(),
    express_validator_1.body('parentOrganization.name.ja')
        .not()
        .isEmpty()
        .withMessage(() => 'required')
        .isString(),
    express_validator_1.body('parentOrganization.name.en')
        .not()
        .isEmpty()
        .withMessage(() => 'required')
        .isString(),
    express_validator_1.body('settings.cognito.adminUserPool.id')
        .not()
        .isEmpty()
        .withMessage(() => 'required')
        .isString(),
    express_validator_1.body('settings.cognito.customerUserPool.id')
        .not()
        .isEmpty()
        .withMessage(() => 'required')
        .isString(),
    express_validator_1.body('settings.gmo.endpoint')
        .not()
        .isEmpty()
        .withMessage(() => 'required')
        .isString(),
    express_validator_1.body('settings.gmo.siteId')
        .not()
        .isEmpty()
        .withMessage(() => 'required')
        .isString(),
    express_validator_1.body('settings.gmo.sitePass')
        .not()
        .isEmpty()
        .withMessage(() => 'required')
        .isString(),
    // body('settings.mvtkReserve.companyCode')
    //     .not()
    //     .isEmpty()
    //     .withMessage(() => 'required')
    //     .isString(),
    express_validator_1.body('settings.mvtkReserve.endpoint')
        .not()
        .isEmpty()
        .withMessage(() => 'required')
        .isString(),
    express_validator_1.body('settings.sendgridApiKey')
        .not()
        .isEmpty()
        .withMessage(() => 'required')
        .isString(),
    express_validator_1.body('settings.transactionWebhookUrl')
        .not()
        .isEmpty()
        .withMessage(() => 'required')
        .isString()
], validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        const memberRepo = new cinerino.repository.Member(mongoose.connection);
        const projectRepo = new cinerino.repository.Project(mongoose.connection);
        let project = createFromBody(req.body);
        let member;
        const adminUserPoolId = (_b = (_a = project.settings) === null || _a === void 0 ? void 0 : _a.cognito) === null || _b === void 0 ? void 0 : _b.adminUserPool.id;
        const personRepo = new cinerino.repository.Person({
            userPoolId: adminUserPoolId
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
        project = yield projectRepo.projectModel.create(Object.assign(Object.assign({}, project), { _id: project.id }))
            .then((doc) => doc.toObject());
        // 権限作成
        yield memberRepo.memberModel.create({
            project: { typeOf: project.typeOf, id: project.id },
            typeOf: 'OrganizationRole',
            member: member
        });
        res.status(http_status_1.CREATED)
            .json(project);
    }
    catch (error) {
        next(error);
    }
}));
function createFromBody(params) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v;
    return Object.assign({ id: params.id, typeOf: params.typeOf, logo: params.logo, name: params.name, parentOrganization: params.parentOrganization, settings: {
            cognito: {
                adminUserPool: {
                    id: (_c = (_b = (_a = params.settings) === null || _a === void 0 ? void 0 : _a.cognito) === null || _b === void 0 ? void 0 : _b.adminUserPool) === null || _c === void 0 ? void 0 : _c.id
                },
                customerUserPool: {
                    id: (_f = (_e = (_d = params.settings) === null || _d === void 0 ? void 0 : _d.cognito) === null || _e === void 0 ? void 0 : _e.customerUserPool) === null || _f === void 0 ? void 0 : _f.id
                }
            },
            gmo: {
                endpoint: (_h = (_g = params.settings) === null || _g === void 0 ? void 0 : _g.gmo) === null || _h === void 0 ? void 0 : _h.endpoint,
                siteId: (_k = (_j = params.settings) === null || _j === void 0 ? void 0 : _j.gmo) === null || _k === void 0 ? void 0 : _k.siteId,
                sitePass: (_m = (_l = params.settings) === null || _l === void 0 ? void 0 : _l.gmo) === null || _m === void 0 ? void 0 : _m.sitePass
            },
            mvtkReserve: {
                companyCode: (typeof ((_p = (_o = params.settings) === null || _o === void 0 ? void 0 : _o.mvtkReserve) === null || _p === void 0 ? void 0 : _p.companyCode) === 'string')
                    ? (_r = (_q = params.settings) === null || _q === void 0 ? void 0 : _q.mvtkReserve) === null || _r === void 0 ? void 0 : _r.companyCode : '',
                endpoint: (_t = (_s = params.settings) === null || _s === void 0 ? void 0 : _s.mvtkReserve) === null || _t === void 0 ? void 0 : _t.endpoint
            },
            onOrderStatusChanged: {},
            codeExpiresInSeconds: 600,
            sendgridApiKey: (_u = params.settings) === null || _u === void 0 ? void 0 : _u.sendgridApiKey,
            transactionWebhookUrl: (_v = params.settings) === null || _v === void 0 ? void 0 : _v.transactionWebhookUrl,
            useUsernameAsGMOMemberId: false
        } }, {
        subscription: { identifier: 'Free' }
    });
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
        const projectRepo = new cinerino.repository.Project(mongoose.connection);
        // tslint:disable-next-line:no-magic-numbers
        const limit = (req.query.limit !== undefined) ? Math.min(req.query.limit, 100) : 100;
        const page = (req.query.page !== undefined) ? Math.max(req.query.page, 1) : 1;
        // 権限を持つプロジェクト検索
        const searchCoinditions = {
            'member.id': req.user.sub
        };
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
        res.json(projects);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * プロジェクト取得
 */
projectsRouter.get('/:id', permitScopes_1.default(['projects.*', 'projects.read']), rateLimit_1.default, validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const projectRepo = new cinerino.repository.Project(mongoose.connection);
        const projection = (req.memberPermissions.indexOf(`${RESOURCE_SERVER_IDENTIFIER}/projects.settings.read`) >= 0)
            ? undefined
            : { settings: 0 };
        const project = yield projectRepo.findById({ id: req.project.id }, projection);
        res.json(project);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * プロジェクト更新
 */
projectsRouter.patch('/:id', permitScopes_1.default(['projects.*', 'projects.write']), rateLimit_1.default, ...[], validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _c, _d, _e, _f;
    try {
        const projectRepo = new cinerino.repository.Project(mongoose.connection);
        yield projectRepo.projectModel.findOneAndUpdate({ _id: req.project.id }, Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({ updatedAt: new Date() }, (typeof req.body.name === 'string' && req.body.name.length > 0) ? { name: req.body.name } : undefined), (typeof req.body.logo === 'string' && req.body.logo.length > 0) ? { logo: req.body.logo } : undefined), (typeof ((_c = req.body.settings) === null || _c === void 0 ? void 0 : _c.codeExpiresInSeconds) === 'number')
            ? { 'settings.codeExpiresInSeconds': (_d = req.body.settings) === null || _d === void 0 ? void 0 : _d.codeExpiresInSeconds }
            : undefined), (typeof ((_e = req.body.settings) === null || _e === void 0 ? void 0 : _e.transactionWebhookUrl) === 'string')
            ? { 'settings.transactionWebhookUrl': (_f = req.body.settings) === null || _f === void 0 ? void 0 : _f.transactionWebhookUrl }
            : undefined), { 
            // 機能改修で不要になった属性を削除
            $unset: {
                'settings.chevre': 1,
                'settings.pecorino': 1,
                'settings.emailInformUpdateProgrammembership': 1,
                'settings.useInMemoryOfferRepo': 1,
                'settings.useReservationNumberAsConfirmationNumber': 1
            } }))
            .exec();
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
    try {
        const projectRepo = new cinerino.repository.Project(mongoose.connection);
        const project = yield projectRepo.findById({ id: req.project.id });
        res.json(project.settings);
    }
    catch (error) {
        next(error);
    }
}));
exports.default = projectsRouter;
