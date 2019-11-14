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
// import { OK } from 'http-status';
const mongoose = require("mongoose");
const authentication_1 = require("../middlewares/authentication");
const permitScopes_1 = require("../middlewares/permitScopes");
const validator_1 = require("../middlewares/validator");
const iamRouter = express.Router();
iamRouter.use(authentication_1.default);
/**
 * IAMグループ検索
 */
iamRouter.get('/groups', permitScopes_1.default([]), validator_1.default, (_, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        res.set('X-Total-Count', '0');
        res.json([]);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * IAMロール検索
 */
iamRouter.get('/roles', permitScopes_1.default([]), validator_1.default, (_, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        res.set('X-Total-Count', '0');
        res.json([]);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * IAMユーザー検索
 */
iamRouter.get('/users', permitScopes_1.default([]), validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const projectRepo = new cinerino.repository.Project(mongoose.connection);
        const project = yield projectRepo.findById({ id: req.project.id });
        if (project.settings === undefined
            || project.settings.cognito === undefined) {
            throw new cinerino.factory.errors.ServiceUnavailable('Project settings undefined');
        }
        const personRepo = new cinerino.repository.Person({
            userPoolId: project.settings.cognito.adminUserPool.id
        });
        const users = yield personRepo.search({
            id: req.query.id,
            username: req.query.username,
            email: req.query.email,
            telephone: req.query.telephone,
            givenName: req.query.givenName,
            familyName: req.query.familyName
        });
        res.set('X-Total-Count', users.length.toString());
        res.json(users);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * IDでユーザー検索
 */
iamRouter.get('/users/:id', permitScopes_1.default([]), validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const projectRepo = new cinerino.repository.Project(mongoose.connection);
        const project = yield projectRepo.findById({ id: req.project.id });
        if (project.settings === undefined
            || project.settings.cognito === undefined) {
            throw new cinerino.factory.errors.ServiceUnavailable('Project settings undefined');
        }
        const personRepo = new cinerino.repository.Person({
            userPoolId: project.settings.cognito.adminUserPool.id
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
exports.default = iamRouter;
