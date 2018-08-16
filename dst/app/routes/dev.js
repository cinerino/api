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
 * devルーター
 */
const cinerino = require("@cinerino/domain");
const express = require("express");
const http_status_1 = require("http-status");
const mongooseConnectionOptions_1 = require("../../mongooseConnectionOptions");
const devRouter = express.Router();
devRouter.get('/500', () => {
    throw new Error('500 manually');
});
devRouter.get('/environmentVariables', (__, res) => {
    res.json(process.env);
});
devRouter.get('/mongoose/connect', (__, res) => __awaiter(this, void 0, void 0, function* () {
    yield cinerino.mongoose.connect(process.env.MONGOLAB_URI, mongooseConnectionOptions_1.default);
    res.status(http_status_1.NO_CONTENT).end();
}));
exports.default = devRouter;
