/**
 * ヘルスチェックルーター
 */
import * as cinerino from '@cinerino/domain';
import * as express from 'express';
const healthRouter = express.Router();

import * as createDebug from 'debug';
import { OK } from 'http-status';

import * as redis from '../../redis';

const debug = createDebug('cinerino-api:router');
// 接続確認をあきらめる時間(ミリ秒)
const TIMEOUT_GIVE_UP_CHECKING_IN_MILLISECONDS = 3000;

healthRouter.get(
    '',
    async (_, res, next) => {
        try {
            await Promise.all([
                new Promise((resolve, reject) => {
                    let givenUpChecking = false;

                    // mongodb接続状態チェック
                    cinerino.mongoose.connection.db.admin().ping((err, result) => {
                        debug('mongodb ping:', err, result);
                        // すでにあきらめていたら何もしない
                        if (givenUpChecking) {
                            return;
                        }

                        if (err instanceof Error) {
                            reject(err);
                        } else {
                            resolve();
                        }
                    });

                    setTimeout(
                        () => {
                            givenUpChecking = true;
                            reject(new Error('unable to check db connection'));
                        },
                        TIMEOUT_GIVE_UP_CHECKING_IN_MILLISECONDS
                    );
                }),
                new Promise(async (resolve, reject) => {
                    let givenUpChecking = false;

                    // redisサーバー接続が生きているかどうか確認
                    redis.getClient().ping('wake up!', (err, reply) => {
                        debug('redis ping:', err, reply);
                        // すでにあきらめていたら何もしない
                        if (givenUpChecking) {
                            return;
                        }

                        if (err instanceof Error) {
                            reject(err);
                        } else {
                            resolve();
                        }
                    });

                    setTimeout(
                        () => {
                            givenUpChecking = true;
                            reject(new Error('unable to check db connection'));
                        },
                        TIMEOUT_GIVE_UP_CHECKING_IN_MILLISECONDS
                    );
                })
            ]);

            res.status(OK).send('healthy!');
        } catch (error) {
            next(error);
        }
    });

export default healthRouter;
