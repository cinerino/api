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
 * IAMルーター
 */
const cinerino = require("@cinerino/domain");
const express = require("express");
const http_status_1 = require("http-status");
const permitScopes_1 = require("../middlewares/permitScopes");
const rateLimit_1 = require("../middlewares/rateLimit");
const validator_1 = require("../middlewares/validator");
const members_1 = require("./iam/members");
const roles_1 = require("./iam/roles");
const ADMIN_USER_POOL_ID = process.env.ADMIN_USER_POOL_ID;
const iamRouter = express.Router();
iamRouter.use('/members', members_1.default);
iamRouter.use('/roles', roles_1.default);
/**
 * IAMグループ検索
 */
iamRouter.get('/groups', permitScopes_1.default([]), rateLimit_1.default, validator_1.default, (_, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        res.json([]);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * IAMユーザー検索
 */
iamRouter.get('/users', permitScopes_1.default([]), rateLimit_1.default, validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const personRepo = new cinerino.repository.Person({
            userPoolId: ADMIN_USER_POOL_ID
        });
        const users = yield personRepo.search({
            id: req.query.id,
            username: req.query.username,
            email: req.query.email,
            telephone: req.query.telephone,
            givenName: req.query.givenName,
            familyName: req.query.familyName
        });
        res.json(users);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * IDでユーザー検索
 */
iamRouter.get('/users/:id', permitScopes_1.default([]), rateLimit_1.default, validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const personRepo = new cinerino.repository.Person({
            userPoolId: ADMIN_USER_POOL_ID
        });
        const user = yield personRepo.findById({
            userId: req.params.id
        });
        res.json(user);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * プロフィール検索
 */
iamRouter.get('/users/:id/profile', permitScopes_1.default([]), rateLimit_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const personRepo = new cinerino.repository.Person({
            userPoolId: ADMIN_USER_POOL_ID
        });
        const person = yield personRepo.findById({
            userId: req.params.id
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
 * プロフィール更新
 */
iamRouter.patch('/users/:id/profile', permitScopes_1.default([]), rateLimit_1.default, validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const personRepo = new cinerino.repository.Person({
            userPoolId: ADMIN_USER_POOL_ID
        });
        const person = yield personRepo.findById({
            userId: req.params.id
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
exports.default = iamRouter;
