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
const http_status_1 = require("http-status");
const mongoose = require("mongoose");
const permitScopes_1 = require("../../middlewares/permitScopes");
const rateLimit_1 = require("../../middlewares/rateLimit");
const validator_1 = require("../../middlewares/validator");
const iamMembersRouter = express.Router();
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
