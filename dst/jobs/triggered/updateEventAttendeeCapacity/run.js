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
 * イベント残席数を更新する
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
    let holdSingletonProcess = false;
    setInterval(() => __awaiter(this, void 0, void 0, function* () {
        // tslint:disable-next-line:no-magic-numbers
        holdSingletonProcess = yield singletonProcess.lock({ key: 'updateEventAttendeeCapacity', ttl: 60 });
    }), 
    // tslint:disable-next-line:no-magic-numbers
    10000);
    const connection = yield connectMongo_1.connectMongo({ defaultConnection: false });
    const redisClient = cinerino.redis.createClient({
        host: process.env.REDIS_HOST,
        port: Number(process.env.REDIS_PORT),
        password: process.env.REDIS_KEY,
        tls: (process.env.REDIS_TLS_SERVERNAME !== undefined) ? { servername: process.env.REDIS_TLS_SERVERNAME } : undefined
    });
    const job = new cron_1.CronJob('* * * * *', () => __awaiter(this, void 0, void 0, function* () {
        if (!holdSingletonProcess) {
            return;
        }
        const attendeeCapacityRepo = new cinerino.repository.event.AttendeeCapacityRepo(redisClient);
        const sellerRepo = new cinerino.repository.Seller(connection);
        const chevreAuthClient = new cinerino.chevre.auth.ClientCredentials({
            domain: process.env.CHEVRE_AUTHORIZE_SERVER_DOMAIN,
            clientId: process.env.CHEVRE_CLIENT_ID,
            clientSecret: process.env.CHEVRE_CLIENT_SECRET,
            scopes: [],
            state: ''
        });
        const eventService = new cinerino.chevre.service.Event({
            endpoint: process.env.CHEVRE_ENDPOINT,
            auth: chevreAuthClient
        });
        const sellers = yield sellerRepo.search({});
        const importFrom = moment()
            .toDate();
        const importThrough = moment()
            .add(LENGTH_IMPORT_SCREENING_EVENTS_IN_WEEKS, 'weeks')
            .toDate();
        // const runsAt = new Date();
        yield Promise.all(sellers.map((seller) => __awaiter(this, void 0, void 0, function* () {
            try {
                if (Array.isArray(seller.makesOffer)) {
                    yield Promise.all(seller.makesOffer.map((offer) => __awaiter(this, void 0, void 0, function* () {
                        yield cinerino.service.stock.updateEventRemainingAttendeeCapacities({
                            locationBranchCode: offer.itemOffered.reservationFor.location.branchCode,
                            offeredThrough: offer.offeredThrough,
                            importFrom: importFrom,
                            importThrough: importThrough
                        })({
                            attendeeCapacity: attendeeCapacityRepo,
                            eventService: eventService
                        });
                    })));
                }
            }
            catch (error) {
                console.error(error);
            }
        })));
    }), undefined, true);
    debug('job started', job);
});
