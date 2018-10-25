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
 * 取引タスクエクスポートが実行中のままになっている取引を監視する
 */
const cinerino = require("@cinerino/domain");
const createDebug = require("debug");
const connectMongo_1 = require("../../../../connectMongo");
const debug = createDebug('cinerino-api');
exports.default = () => __awaiter(this, void 0, void 0, function* () {
    const connection = yield connectMongo_1.connectMongo({ defaultConnection: false });
    let countRetry = 0;
    const MAX_NUBMER_OF_PARALLEL_TASKS = 10;
    const INTERVAL_MILLISECONDS = 500;
    const transactionRepo = new cinerino.repository.Transaction(connection);
    const RETRY_INTERVAL_MINUTES = 10;
    setInterval(() => __awaiter(this, void 0, void 0, function* () {
        if (countRetry > MAX_NUBMER_OF_PARALLEL_TASKS) {
            return;
        }
        countRetry += 1;
        try {
            debug('reexporting tasks...');
            yield transactionRepo.reexportTasks({ intervalInMinutes: RETRY_INTERVAL_MINUTES });
        }
        catch (error) {
            console.error(error);
        }
        countRetry -= 1;
    }), INTERVAL_MILLISECONDS);
});
