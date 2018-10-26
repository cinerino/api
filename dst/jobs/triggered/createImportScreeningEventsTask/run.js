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
 * 上映イベントインポートタスク作成
 */
const cinerino = require("@cinerino/domain");
const moment = require("moment");
const cron = require("node-cron");
const connectMongo_1 = require("../../../connectMongo");
/**
 * 上映イベントを何週間後までインポートするか
 */
const LENGTH_IMPORT_SCREENING_EVENTS_IN_WEEKS = (process.env.LENGTH_IMPORT_SCREENING_EVENTS_IN_WEEKS !== undefined)
    // tslint:disable-next-line:no-magic-numbers
    ? parseInt(process.env.LENGTH_IMPORT_SCREENING_EVENTS_IN_WEEKS, 10)
    : 1;
exports.default = () => __awaiter(this, void 0, void 0, function* () {
    const connection = yield connectMongo_1.connectMongo({ defaultConnection: false });
    cron.schedule('*/5 * * * *', () => __awaiter(this, void 0, void 0, function* () {
        const taskRepo = new cinerino.repository.Task(connection);
        const organizationRepo = new cinerino.repository.Organization(connection);
        // 全劇場組織を取得
        const movieTheaters = yield organizationRepo.searchMovieTheaters({});
        const importFrom = moment().toDate();
        const importThrough = moment().add(LENGTH_IMPORT_SCREENING_EVENTS_IN_WEEKS, 'weeks').toDate();
        const runsAt = new Date();
        yield Promise.all(movieTheaters.map((movieTheater) => __awaiter(this, void 0, void 0, function* () {
            try {
                const taskAttributes = {
                    name: cinerino.factory.taskName.ImportScreeningEvents,
                    status: cinerino.factory.taskStatus.Ready,
                    runsAt: runsAt,
                    remainingNumberOfTries: 1,
                    lastTriedAt: null,
                    numberOfTried: 0,
                    executionResults: [],
                    data: {
                        locationBranchCode: movieTheater.location.branchCode,
                        importFrom: importFrom,
                        importThrough: importThrough
                    }
                };
                yield taskRepo.save(taskAttributes);
            }
            catch (error) {
                console.error(error);
            }
        })));
    }));
});
