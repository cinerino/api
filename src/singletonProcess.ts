/**
 * Singletonプロセス管理
 */
import * as cinerino from '@cinerino/domain';
import * as createDebug from 'debug';
import * as moment from 'moment';
import * as os from 'os';
import * as util from 'util';

import * as redis from './redis';

const debug = createDebug('cinerino-api:singletonProcess');

const processId = util.format(
    '%s:%s:%s',
    os.hostname,
    process.pid,
    moment().unix
);

/**
 * Signletonプロセスをロックする
 */
export async function lock(params: { key: string; ttl: number }) {
    const redisClient = redis.getClient();

    // ロック処理
    const key = `api:singletonProcess:${params.key}`;
    const value = processId;
    const ttl = params.ttl;
    let locked = false;
    let self = false;

    // ロックトライ
    debug('locking singleton process...', key, value);
    locked = await new Promise<boolean>((resolve) => {
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
        self = await new Promise<boolean>((resolve) => {
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
        locked = await new Promise<boolean>((resolve) => {
            redisClient.expire(key, ttl, (_, result) => {
                resolve(result === 1);
            });
        });
        debug('expire set', self, key);
    }

    if (process.env.DEBUG_SINGLETON_PROCESS === '1') {
        await cinerino.service.notification.report2developers(
            `[${process.env.PROJECT_ID}] api:singletonProcess`,
            util.format(
                '%s\n%s\n%s\n%s\n%s\n%s',
                `key: ${key}`,
                `value: ${value}`,
                `locked: ${locked}`,
                `os.hostname: ${os.hostname}`,
                `pid: ${process.pid}`
            )
        )();
    }

    return locked;
}
