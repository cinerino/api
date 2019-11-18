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
 * 上映イベントインポートタスク作成
 */
const cinerino = require("@cinerino/domain");
const cron_1 = require("cron");
const createDebug = require("debug");
const moment = require("moment");
const os = require("os");
const util = require("util");
const connectMongo_1 = require("../../../connectMongo");
const singletonProcess = require("../../../singletonProcess");
const debug = createDebug('cinerino-api:jobs');
/**
 * 上映イベントを何週間後までインポートするか
 */
const IMPORT_EVENTS_IN_WEEKS = (process.env.IMPORT_EVENTS_IN_WEEKS !== undefined)
    ? Number(process.env.IMPORT_EVENTS_IN_WEEKS)
    : 1;
const IMPORT_EVENTS_PER_WEEKS = (process.env.IMPORT_EVENTS_PER_WEEKS !== undefined)
    ? Number(process.env.IMPORT_EVENTS_PER_WEEKS)
    : 1;
const MAX_IMPORT_EVENTS_INTERVAL_IN_MINUTES = 60;
const IMPORT_EVENTS_INTERVAL_IN_MINUTES = (process.env.IMPORT_EVENTS_INTERVAL_IN_MINUTES !== undefined)
    ? Math.min(Number(process.env.IMPORT_EVENTS_INTERVAL_IN_MINUTES), MAX_IMPORT_EVENTS_INTERVAL_IN_MINUTES)
    : MAX_IMPORT_EVENTS_INTERVAL_IN_MINUTES;
// tslint:disable-next-line:max-func-body-length
exports.default = (params) => __awaiter(void 0, void 0, void 0, function* () {
    let holdSingletonProcess = false;
    setInterval(() => __awaiter(void 0, void 0, void 0, function* () {
        holdSingletonProcess = yield singletonProcess.lock({
            project: params.project,
            key: 'createImportScreeningEventsTask',
            ttl: 60
        });
    }), 
    // tslint:disable-next-line:no-magic-numbers
    10000);
    const connection = yield connectMongo_1.connectMongo({ defaultConnection: false });
    const job = new cron_1.CronJob(`*/${IMPORT_EVENTS_INTERVAL_IN_MINUTES} * * * *`, 
    // tslint:disable-next-line:max-func-body-length
    () => __awaiter(void 0, void 0, void 0, function* () {
        if (process.env.DEBUG_SINGLETON_PROCESS === '1') {
            yield cinerino.service.notification.report2developers(`[${process.env.PROJECT_ID}] api:singletonProcess`, util.format('%s\n%s\n%s\n%s\n%s', `key: 'createImportScreeningEventsTask'`, `IMPORT_EVENTS_INTERVAL_IN_MINUTES: ${IMPORT_EVENTS_INTERVAL_IN_MINUTES}`, `holdSingletonProcess: ${holdSingletonProcess}`, `os.hostname: ${os.hostname}`, `pid: ${process.pid}`))();
        }
        if (process.env.IMPORT_EVENTS_STOPPED === '1') {
            return;
        }
        if (!holdSingletonProcess) {
            return;
        }
        const taskRepo = new cinerino.repository.Task(connection);
        const sellerRepo = new cinerino.repository.Seller(connection);
        const sellers = yield sellerRepo.search({
            project: (params.project !== undefined) ? { ids: [params.project.id] } : undefined
        });
        const now = new Date();
        const runsAt = now;
        // 1週間ずつインポート
        // tslint:disable-next-line:prefer-array-literal
        yield Promise.all([...Array(Math.ceil(IMPORT_EVENTS_IN_WEEKS / IMPORT_EVENTS_PER_WEEKS))].map((_, i) => __awaiter(void 0, void 0, void 0, function* () {
            const importFrom = moment(now)
                .add(i, 'weeks')
                .toDate();
            const importThrough = moment(importFrom)
                .add(IMPORT_EVENTS_PER_WEEKS, 'weeks')
                .toDate();
            yield Promise.all(sellers.map((seller) => __awaiter(void 0, void 0, void 0, function* () {
                try {
                    if (Array.isArray(seller.makesOffer)) {
                        yield Promise.all(seller.makesOffer.map((offer) => __awaiter(void 0, void 0, void 0, function* () {
                            const taskAttributes = {
                                name: cinerino.factory.taskName.ImportScreeningEvents,
                                status: cinerino.factory.taskStatus.Ready,
                                runsAt: runsAt,
                                remainingNumberOfTries: 1,
                                numberOfTried: 0,
                                executionResults: [],
                                data: {
                                    project: params.project,
                                    locationBranchCode: offer.itemOffered.reservationFor.location.branchCode,
                                    offeredThrough: offer.offeredThrough,
                                    importFrom: importFrom,
                                    importThrough: importThrough
                                },
                                project: params.project
                            };
                            yield taskRepo.save(taskAttributes);
                        })));
                    }
                }
                catch (error) {
                    console.error(error);
                }
            })));
        })));
    }), undefined, true);
    debug('job started', job);
});
