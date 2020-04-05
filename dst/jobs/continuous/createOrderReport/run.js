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
 * 注文レポート作成
 */
const cinerino = require("@cinerino/domain");
const connectMongo_1 = require("../../../connectMongo");
exports.default = (params) => __awaiter(void 0, void 0, void 0, function* () {
    let connection;
    let count = 0;
    const MAX_NUBMER_OF_PARALLEL_TASKS = 0;
    const INTERVAL_MILLISECONDS = 200;
    setInterval(() => __awaiter(void 0, void 0, void 0, function* () {
        if (count > MAX_NUBMER_OF_PARALLEL_TASKS) {
            return;
        }
        count += 1;
        try {
            // 長時間処理の可能性があるので、都度コネクション生成
            connection = yield connectMongo_1.connectMongo({
                defaultConnection: false,
                disableCheck: true
            });
            yield cinerino.service.task.executeByName({
                project: params.project,
                name: 'createOrderReport'
            })({
                connection: connection
            });
        }
        catch (error) {
            console.error(error);
        }
        try {
            if (connection !== undefined) {
                yield connection.close();
            }
        }
        catch (error) {
            console.error(error);
        }
        count -= 1;
    }), INTERVAL_MILLISECONDS);
});
