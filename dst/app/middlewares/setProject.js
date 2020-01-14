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
    // アプリケーションからプロジェクトをセット
    // if (req.application !== undefined && req.application !== null) {
    //     if (req.application.project !== undefined && req.application.project !== null) {
    //         project = { typeOf: req.application.project.typeOf, id: req.application.project.id };
    //     }
    // }
    // アプリケーションクライアントが権限を持つプロジェクトが1つのみであれば、プロジェクトセット
    const memberRepo = new cinerino.repository.Member(mongoose.connection);
    const applicationMemberCount = yield memberRepo.count({
        member: { id: { $eq: req.user.client_id } }
    });
    if (applicationMemberCount === 1) {
        const applicationMember = yield memberRepo.search({
            member: { id: { $eq: req.user.client_id } }
        });
        project = { typeOf: applicationMember[0].project.typeOf, id: applicationMember[0].project.id };
    }
    // 環境変数設定が存在する場合
    if (typeof process.env.PROJECT_ID === 'string') {
        if (project === undefined) {
            // 環境変数
            project = { typeOf: cinerino.factory.organizationType.Project, id: process.env.PROJECT_ID };
        }
        else {
            // アプリケーション設定と環境変数設定両方が存在する場合、プロジェクトが異なればforbidden
            if (project.id !== process.env.PROJECT_ID) {
                next(new cinerino.factory.errors.Forbidden(`client for ${project.id} forbidden`));
                return;
            }
        }
    }
    // プロジェクトが決定すればリクエストに設定
    if (project !== undefined) {
        req.project = project;
    }
    next();
}));
// プロジェクト指定ルーティング配下については、すべてreq.projectを上書き
setProject.use('/projects/:id', (req, _, next) => {
    // authenticationにてアプリケーションによってプロジェクト決定済であれば、比較
    // 本番マルチテナントサービスを設置するまで保留
    // if (req.project !== undefined && req.project !== null) {
    //     if (req.project.id !== req.params.id) {
    //         next(new cinerino.factory.errors.Forbidden(`client for ${req.project.id} forbidden`));
    //         return;
    //     }
    // }
    req.project = { typeOf: cinerino.factory.organizationType.Project, id: req.params.id };
    next();
});
exports.default = setProject;
