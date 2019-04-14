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
 * パフォーマンス空席状況を更新する
 * COA空席情報から空席状況を生成してredisに保管する
 */
const cinerino = require("@cinerino/domain");
const cron_1 = require("cron");
const createDebug = require("debug");
const moment = require("moment");
const connectMongo_1 = require("../../../connectMongo");
const singletonProcess = require("../../../singletonProcess");
const debug = createDebug('cinerino-api:jobs');
/**
 * 上映イベントを何週間後までインポートするか
 */
const LENGTH_IMPORT_SCREENING_EVENTS_IN_WEEKS = (process.env.LENGTH_IMPORT_SCREENING_EVENTS_IN_WEEKS !== undefined)
    ? Number(process.env.LENGTH_IMPORT_SCREENING_EVENTS_IN_WEEKS)
    : 1;
exports.default = () => __awaiter(this, void 0, void 0, function* () {
    // Cinemasunshineのみでこのタスクは使用
    if (process.env.USE_REDIS_EVENT_ITEM_AVAILABILITY_REPO !== '1') {
        return;
    }
    let holdSingletonProcess = false;
    setInterval(() => __awaiter(this, void 0, void 0, function* () {
        // tslint:disable-next-line:no-magic-numbers
        holdSingletonProcess = yield singletonProcess.lock({ key: 'updateScreeningEventAvailability', ttl: 60 });
    }), 
    // tslint:disable-next-line:no-magic-numbers
    10000);
    const connection = yield connectMongo_1.connectMongo({ defaultConnection: false });
    const redisClient = cinerino.redis.createClient({
        host: process.env.REDIS_HOST,
        // tslint:disable-next-line:no-magic-numbers
        port: Number(process.env.REDIS_PORT),
        password: process.env.REDIS_KEY,
        tls: (process.env.REDIS_TLS_SERVERNAME !== undefined) ? { servername: process.env.REDIS_TLS_SERVERNAME } : undefined
    });
    const job = new cron_1.CronJob('* * * * *', () => __awaiter(this, void 0, void 0, function* () {
        if (!holdSingletonProcess) {
            return;
        }
        const itemAvailabilityRepo = new cinerino.repository.itemAvailability.ScreeningEvent(redisClient);
        const sellerRepo = new cinerino.repository.Seller(connection);
        // 販売者ごとにイベント在庫状況を更新
        const sellers = yield sellerRepo.search({});
        const startFrom = moment()
            .toDate();
        const startThrough = moment()
            .add(LENGTH_IMPORT_SCREENING_EVENTS_IN_WEEKS, 'weeks')
            .toDate();
        yield Promise.all(sellers.map((seller) => __awaiter(this, void 0, void 0, function* () {
            try {
                if (seller.location !== undefined && seller.location.branchCode !== undefined) {
                    yield cinerino.service.offer.updateEventItemAvailability(seller.location.branchCode, startFrom, startThrough)({ itemAvailability: itemAvailabilityRepo });
                    debug('item availability updated');
                }
            }
            catch (error) {
                // tslint:disable-next-line:no-console
                console.error(error);
            }
        })));
    }), undefined, true);
    debug('job started', job);
});
