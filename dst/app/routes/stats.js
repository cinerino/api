"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * 統計ルーター
 */
const express = require("express");
const mongoose = require("mongoose");
const statsRouter = express.Router();
const http_status_1 = require("http-status");
statsRouter.get('/dbStats', (_, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const stats = yield mongoose.connection.db.stats();
        res.status(http_status_1.OK)
            .json(stats);
    }
    catch (error) {
        next(error);
    }
}));
exports.default = statsRouter;
