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
 * プロジェクトメンバールーター
 */
const cinerino = require("@cinerino/domain");
const express = require("express");
const express_validator_1 = require("express-validator");
const http_status_1 = require("http-status");
const mongoose = require("mongoose");
const permitScopes_1 = require("../../middlewares/permitScopes");
const rateLimit_1 = require("../../middlewares/rateLimit");
const validator_1 = require("../../middlewares/validator");
const me_1 = require("./members/me");
const iam_1 = require("../../iam");
const cognitoIdentityServiceProvider = new cinerino.AWS.CognitoIdentityServiceProvider({
    apiVersion: 'latest',
    region: 'ap-northeast-1',
    credentials: new cinerino.AWS.Credentials({
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    })
});
const iamMembersRouter = express.Router();
iamMembersRouter.use('/me', me_1.default);
/**
 * プロジェクトメンバー追加
 */
iamMembersRouter.post('', permitScopes_1.default([]), rateLimit_1.default, ...[
    express_validator_1.body('member')
        .not()
        .isEmpty()
        .withMessage(() => 'required'),
    express_validator_1.body('member.applicationCategory')
        .not()
        .isEmpty()
        .withMessage(() => 'required')
        .isIn(['customer', 'admin']),
    express_validator_1.body('member.id')
        .not()
        .isEmpty()
        .withMessage(() => 'required')
        .isString(),
    express_validator_1.body('member.typeOf')
        .not()
        .isEmpty()
        .withMessage(() => 'required')
        .isIn([cinerino.factory.personType.Person, cinerino.factory.creativeWorkType.WebApplication]),
    express_validator_1.body('member.hasRole')
        .not()
        .isEmpty()
        .withMessage(() => 'required')
        .isArray(),
    express_validator_1.body('member.hasRole.*.roleName')
        .not()
        .isEmpty()
        .withMessage(() => 'required')
        .isString()
], validator_1.default, 
// tslint:disable-next-line:max-func-body-length
(req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const memberRepo = new cinerino.repository.Member(mongoose.connection);
        const projectRepo = new cinerino.repository.Project(mongoose.connection);
        const project = yield projectRepo.findById({ id: req.project.id });
        if (project.settings === undefined || project.settings.cognito === undefined) {
            throw new cinerino.factory.errors.ServiceUnavailable('Project settings not satisfied');
        }
        let member;
        // ロールをひとつに限定
        const role = {
            typeOf: 'OrganizationRole',
            roleName: req.body.member.hasRole.shift().roleName,
            memberOf: { typeOf: project.typeOf, id: project.id }
        };
        const applicationCategory = req.body.member.applicationCategory;
        let userPoolClient;
        switch (applicationCategory) {
            case 'customer':
                // カスタマーロールの場合
                const customerUserPoolId = project.settings.cognito.customerUserPool.id;
                // クライアント検索
                userPoolClient =
                    yield new Promise((resolve, reject) => {
                        cognitoIdentityServiceProvider.describeUserPoolClient({
                            UserPoolId: customerUserPoolId,
                            ClientId: req.body.member.id
                        }, (err, data) => {
                            if (err instanceof Error) {
                                reject(err);
                            }
                            else {
                                if (data.UserPoolClient === undefined) {
                                    reject(new cinerino.factory.errors.NotFound('UserPoolClient'));
                                }
                                else {
                                    resolve(data.UserPoolClient);
                                }
                            }
                        });
                    });
                member = {
                    typeOf: cinerino.factory.creativeWorkType.WebApplication,
                    id: userPoolClient.ClientId,
                    name: userPoolClient.ClientName,
                    hasRole: [{
                            typeOf: 'OrganizationRole',
                            roleName: iam_1.RoleName.Customer,
                            memberOf: { typeOf: project.typeOf, id: project.id }
                        }]
                };
                break;
            default:
                // 管理者ロールの場合
                const adminUserPoolId = project.settings.cognito.adminUserPool.id;
                switch (req.body.member.typeOf) {
                    case cinerino.factory.personType.Person:
                        const personRepo = new cinerino.repository.Person({
                            userPoolId: adminUserPoolId
                        });
                        const people = yield personRepo.search({ id: req.body.member.id });
                        if (people[0].memberOf === undefined) {
                            throw new cinerino.factory.errors.NotFound('Administrator.memberOf');
                        }
                        member = {
                            typeOf: people[0].typeOf,
                            id: people[0].id,
                            username: people[0].memberOf.membershipNumber,
                            hasRole: [role]
                        };
                        break;
                    case cinerino.factory.creativeWorkType.WebApplication:
                        // クライアント検索
                        userPoolClient =
                            yield new Promise((resolve, reject) => {
                                cognitoIdentityServiceProvider.describeUserPoolClient({
                                    UserPoolId: adminUserPoolId,
                                    ClientId: req.body.member.id
                                }, (err, data) => {
                                    if (err instanceof Error) {
                                        reject(err);
                                    }
                                    else {
                                        if (data.UserPoolClient === undefined) {
                                            reject(new cinerino.factory.errors.NotFound('UserPoolClient'));
                                        }
                                        else {
                                            resolve(data.UserPoolClient);
                                        }
                                    }
                                });
                            });
                        member = {
                            typeOf: cinerino.factory.creativeWorkType.WebApplication,
                            id: userPoolClient.ClientId,
                            name: userPoolClient.ClientName,
                            hasRole: [{
                                    typeOf: 'OrganizationRole',
                                    roleName: iam_1.RoleName.Customer,
                                    memberOf: { typeOf: project.typeOf, id: project.id }
                                }]
                        };
                        break;
                    default:
                        throw new cinerino.factory.errors.Argument('member.typeOf', 'member type not supported');
                }
        }
        yield memberRepo.memberModel.create({
            project: { typeOf: project.typeOf, id: project.id },
            typeOf: 'OrganizationRole',
            member: member
        });
        res.status(http_status_1.CREATED)
            .json(member);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * プロジェクトメンバー検索
 */
iamMembersRouter.get('', permitScopes_1.default([]), rateLimit_1.default, validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const searchCoinditions = Object.assign(Object.assign({}, req.query), { project: { id: { $eq: req.project.id } }, 
            // tslint:disable-next-line:no-magic-numbers
            limit: (req.query.limit !== undefined) ? Math.min(req.query.limit, 100) : 100, page: (req.query.page !== undefined) ? Math.max(req.query.page, 1) : 1 });
        const memberRepo = new cinerino.repository.Member(mongoose.connection);
        const members = yield memberRepo.search(searchCoinditions);
        const totalCount = yield memberRepo.count(searchCoinditions);
        res.set('X-Total-Count', totalCount.toString());
        res.json(members);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * プロジェクトメンバー取得
 */
iamMembersRouter.get('/:id', permitScopes_1.default([]), rateLimit_1.default, validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const memberRepo = new cinerino.repository.Member(mongoose.connection);
        const members = yield memberRepo.search({
            member: { id: { $eq: req.params.id } },
            project: { id: { $eq: req.project.id } },
            limit: 1
        });
        if (members.length === 0) {
            throw new cinerino.factory.errors.NotFound('Member');
        }
        res.json(members[0].member);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * プロジェクトメンバー削除
 */
iamMembersRouter.delete('/:id', permitScopes_1.default([]), rateLimit_1.default, validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const memberRepo = new cinerino.repository.Member(mongoose.connection);
        const doc = yield memberRepo.memberModel.findOneAndDelete({
            'member.id': {
                $eq: req.params.id
            },
            'project.id': {
                $eq: req.project.id
            }
        })
            .exec();
        if (doc === null) {
            throw new cinerino.factory.errors.NotFound('Member');
        }
        res.status(http_status_1.NO_CONTENT)
            .end();
    }
    catch (error) {
        next(error);
    }
}));
/**
 * プロジェクトメンバープロフィール取得
 */
iamMembersRouter.get('/:id/profile', permitScopes_1.default([]), rateLimit_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const memberRepo = new cinerino.repository.Member(mongoose.connection);
        const projectRepo = new cinerino.repository.Project(mongoose.connection);
        const project = yield projectRepo.findById({ id: req.project.id });
        if (project.settings === undefined
            || project.settings.cognito === undefined) {
            throw new cinerino.factory.errors.ServiceUnavailable('Project settings undefined');
        }
        const members = yield memberRepo.search({
            member: { id: { $eq: req.params.id } },
            project: { id: { $eq: req.project.id } },
            limit: 1
        });
        if (members.length === 0) {
            throw new cinerino.factory.errors.NotFound('Member');
        }
        const member = members[0].member;
        const personRepo = new cinerino.repository.Person({
            userPoolId: project.settings.cognito.adminUserPool.id
        });
        const person = yield personRepo.findById({
            userId: member.id
        });
        if (person.memberOf === undefined) {
            throw new cinerino.factory.errors.NotFound('Person.memberOf');
        }
        const username = person.memberOf.membershipNumber;
        if (username === undefined) {
            throw new cinerino.factory.errors.NotFound('Person.memberOf.membershipNumber');
        }
        const profile = yield personRepo.getUserAttributes({
            username: username
        });
        res.json(profile);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * プロジェクトメンバープロフィール更新
 */
iamMembersRouter.patch('/:id/profile', permitScopes_1.default([]), rateLimit_1.default, validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const memberRepo = new cinerino.repository.Member(mongoose.connection);
        const projectRepo = new cinerino.repository.Project(mongoose.connection);
        const project = yield projectRepo.findById({ id: req.project.id });
        if (project.settings === undefined
            || project.settings.cognito === undefined) {
            throw new cinerino.factory.errors.ServiceUnavailable('Project settings undefined');
        }
        const members = yield memberRepo.search({
            member: { id: { $eq: req.params.id } },
            project: { id: { $eq: req.project.id } },
            limit: 1
        });
        if (members.length === 0) {
            throw new cinerino.factory.errors.NotFound('Member');
        }
        const member = members[0].member;
        const personRepo = new cinerino.repository.Person({
            userPoolId: project.settings.cognito.adminUserPool.id
        });
        const person = yield personRepo.findById({
            userId: member.id
        });
        if (person.memberOf === undefined) {
            throw new cinerino.factory.errors.NotFound('Person.memberOf');
        }
        const username = person.memberOf.membershipNumber;
        if (username === undefined) {
            throw new cinerino.factory.errors.NotFound('Person.memberOf.membershipNumber');
        }
        yield personRepo.updateProfile({
            username: username,
            profile: req.body
        });
        res.status(http_status_1.NO_CONTENT)
            .end();
    }
    catch (error) {
        next(error);
    }
}));
exports.default = iamMembersRouter;
