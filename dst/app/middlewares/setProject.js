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
 * リクエストプロジェクト設定ルーター
 */
const cinerino = require("@cinerino/domain");
const express = require("express");
const mongoose = require("mongoose");
const setProject = express.Router();
setProject.use((req, _, next) => __awaiter(void 0, void 0, void 0, function* () {
    let project;
    // アプリケーションクライアントが権限を持つプロジェクトが1つのみであれば、プロジェクトセット
    const memberRepo = new cinerino.repository.Member(mongoose.connection);
    // const applicationMemberCount = await memberRepo.count({
    //     member: { id: { $eq: req.user.client_id } }
    // });
    const applicationMembers = yield memberRepo.search({
        limit: 2,
        member: { id: { $eq: req.user.client_id } }
    });
    if (applicationMembers.length === 1) {
        // const applicationMember = await memberRepo.search({
        //     member: { id: { $eq: req.user.client_id } }
        // });
        project = { typeOf: applicationMembers[0].project.typeOf, id: applicationMembers[0].project.id };
    }
    // プロジェクトが決定すればリクエストに設定
    if (project !== undefined) {
        req.project = project;
    }
    next();
}));
// プロジェクト指定ルーティング配下については、すべてreq.projectを上書き
setProject.use('/projects/:id', (req, _, next) => __awaiter(void 0, void 0, void 0, function* () {
    req.project = { typeOf: cinerino.factory.chevre.organizationType.Project, id: req.params.id };
    next();
}));
exports.default = setProject;
