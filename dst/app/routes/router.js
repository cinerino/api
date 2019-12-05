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
router.use('', detail_1.default);
router.use('/projects', projects_1.default);
exports.default = router;
