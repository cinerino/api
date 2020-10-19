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
 * 取引期限監視
 */
const cinerino = require("@cinerino/domain");
const moment = require("moment");
const connectMongo_1 = require("../../../connectMongo");
exports.default = (params) => __awaiter(void 0, void 0, void 0, function* () {
    const connection = yield connectMongo_1.connectMongo({ defaultConnection: false });
    let count = 0;
    const MAX_NUBMER_OF_PARALLEL_TASKS = 10;
    const INTERVAL_MILLISECONDS = 1000;
    const transactionRepo = new cinerino.repository.Transaction(connection);
    setInterval(() => __awaiter(void 0, void 0, void 0, function* () {
        if (count > MAX_NUBMER_OF_PARALLEL_TASKS) {
            return;
        }
        count += 1;
        try {
            yield transactionRepo.makeExpired({ project: params.project });
            // 過去の不要な期限切れ取引を削除する
            yield transactionRepo.transactionModel.deleteMany({
                startDate: {
                    $lt: moment()
                        // tslint:disable-next-line:no-magic-numbers
                        .add(-3, 'days')
                        .toDate()
                },
                status: cinerino.factory.transactionStatusType.Expired,
                tasksExportationStatus: cinerino.factory.transactionTasksExportationStatus.Exported
            })
                .exec();
        }
        catch (error) {
            console.error(error);
        }
        count -= 1;
    }), INTERVAL_MILLISECONDS);
});
