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
exports.TransactionProcessRepository = void 0;
const cinerino = require("@cinerino/domain");
const createDebug = require("debug");
const redis = require("redis");
const debug = createDebug('cinerino-api:middlewares');
const redisClient = redis.createClient({
    host: process.env.REDIS_HOST,
    port: Number(process.env.REDIS_PORT),
    password: process.env.REDIS_KEY,
    tls: (process.env.REDIS_TLS_SERVERNAME !== undefined) ? { servername: process.env.REDIS_TLS_SERVERNAME } : undefined
});
const TRANSACTION_RROCESS_LOCK_EXPIRES = (process.env.TRANSACTION_RROCESS_LOCK_EXPIRES !== undefined)
    ? Number(process.env.TRANSACTION_RROCESS_LOCK_EXPIRES)
    // tslint:disable-next-line:no-magic-numbers
    : 120;
/**
 * 取引プロセスリポジトリ
 */
class TransactionProcessRepository {
    constructor(params) {
        this.redisClient = params;
    }
    lock(params) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                const key = `api:${params.project.id}:transactionProcess:${params.typeOf}:${params.id}`;
                const ttl = TRANSACTION_RROCESS_LOCK_EXPIRES;
                debug('locking', key, ttl);
                this.redisClient.multi()
                    .setnx(key, '1')
                    .expire(key, ttl)
                    .exec((err, results) => {
                    debug('locked', err, results);
                    if (err instanceof Error) {
                        reject(err);
                    }
                    else {
                        if (results[0] === 1) {
                            resolve(results[0]);
                        }
                        else {
                            reject(new cinerino.factory.errors.AlreadyInUse('Transaction', [], 'Another transaction process in progress'));
                        }
                    }
                });
            });
        });
    }
    unlock(params) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                const key = `api:${params.project.id}:transactionProcess:${params.typeOf}:${params.id}`;
                this.redisClient.del([key], (err) => {
                    if (err instanceof Error) {
                        reject(err);
                    }
                    else {
                        resolve();
                    }
                });
            });
        });
    }
}
exports.TransactionProcessRepository = TransactionProcessRepository;
/**
 * 取引中の処理の排他処理を行うミドルウェア
 */
exports.default = (params) => {
    return (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        const processRepo = new TransactionProcessRepository(redisClient);
        try {
            const key = Object.assign(Object.assign({}, params), { project: req.project });
            yield processRepo.lock(key);
            // レスポンスが送信されたら解放
            // @see https://nodejs.org/api/http.html#http_event_finish
            res.on('finish', () => __awaiter(void 0, void 0, void 0, function* () {
                debug(req.originalUrl, 'res finished. unlocking...');
                yield processRepo.unlock(key);
            }));
            next();
        }
        catch (error) {
            next(error);
        }
    });
};
