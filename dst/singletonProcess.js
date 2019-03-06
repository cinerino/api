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
 * Singletonプロセス管理
 */
const createDebug = require("debug");
const redis = require("./redis");
const debug = createDebug('cinerino-api:singletonProcess');
/**
 * Signletonプロセスをロックする
 */
function lock(params) {
    return __awaiter(this, void 0, void 0, function* () {
        const redisClient = redis.getClient();
        // ロック処理
        const key = `api:singletonProcess:${params.key}`;
        const value = process.pid.toString();
        const ttl = params.ttl;
        let locked = false;
        let self = false;
        // ロックトライ
        debug('locking singleton process...', key, value);
        locked = yield new Promise((resolve) => {
            redisClient.multi()
                .setnx(key, value)
                .ttl(key)
                .expire(key, ttl)
                .exec((_, results) => {
                debug('setnx ttl expire', results);
                if (!Array.isArray(results)) {
                    resolve(false);
                    return;
                }
                if (results[0] === 1) {
                    resolve(true);
                    return;
                }
                // すでにキーが存在していた場合期限を戻す
                debug('setting expire to previous value...', key, results[1]);
                redisClient.expire(key, results[1], () => {
                    resolve(false);
                });
            });
        });
        debug('locked:', locked, key);
        if (!locked) {
            // ロックプロセス自身かどうか確認
            self = yield new Promise((resolve) => {
                redisClient.get(key, (_, result) => {
                    debug('locked by', result, key);
                    resolve(result === value);
                });
            });
            debug('self:', self, key);
        }
        if (self) {
            // ロックプロセス自身であれば期限更新
            debug('setting expire...', self, key);
            locked = yield new Promise((resolve) => {
                redisClient.expire(key, ttl, (_, result) => {
                    resolve(result === 1);
                });
            });
            debug('expire set', self, key);
        }
        return locked;
    });
}
exports.lock = lock;
