"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * ルーター
 */
const express = require("express");
const health_1 = require("./health");
const projects_1 = require("./projects");
const detail_1 = require("./projects/detail");
const stats_1 = require("./stats");
const authentication_1 = require("../middlewares/authentication");
const setPermissions_1 = require("../middlewares/setPermissions");
const setProject_1 = require("../middlewares/setProject");
const router = express.Router();
// middleware that is specific to this router
// router.use((req, res, next) => {
//   debug('Time: ', Date.now())
//   next()
// })
// 例外的なpublic router
router.use('/health', health_1.default);
router.use('/stats', stats_1.default);
// 認証
router.use(authentication_1.default);
// リクエストプロジェクト設定
router.use(setProject_1.default);
// プロジェクトメンバー権限を確認
router.use(setPermissions_1.default);
// プロジェクトルーター
router.use('/projects', projects_1.default);
// 以下、プロジェクト指定済の状態でルーティング
router.use('', detail_1.default);
router.use('/projects/:id', detail_1.default);
exports.default = router;
