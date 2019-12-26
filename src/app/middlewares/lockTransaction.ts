import * as cinerino from '@cinerino/domain';
import * as createDebug from 'debug';
import { NextFunction, Request, Response } from 'express';
import * as redis from 'redis';

const debug = createDebug('cinerino-api:middlewares');

const redisClient = redis.createClient({
    host: <string>process.env.REDIS_HOST,
    port: Number(<string>process.env.REDIS_PORT),
    password: <string>process.env.REDIS_KEY,
    tls: (process.env.REDIS_TLS_SERVERNAME !== undefined) ? { servername: process.env.REDIS_TLS_SERVERNAME } : undefined
});

const TRANSACTION_RROCESS_LOCK_EXPIRES = (process.env.TRANSACTION_RROCESS_LOCK_EXPIRES !== undefined)
    ? Number(process.env.TRANSACTION_RROCESS_LOCK_EXPIRES)
    // tslint:disable-next-line:no-magic-numbers
    : 120;

export interface IProcessKey {
    project: { id: string };
    typeOf: cinerino.factory.transactionType;
    id: string;
}

/**
 * 取引プロセスリポジトリ
 */
export class TransactionProcessRepository {
    public readonly redisClient: redis.RedisClient;

    constructor(params: redis.RedisClient) {
        this.redisClient = params;
    }

    public async lock(params: IProcessKey): Promise<number> {
        return new Promise<number>((resolve, reject) => {
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
                    } else {
                        if (results[0] === 1) {
                            resolve(results[0]);
                        } else {
                            reject(new cinerino.factory.errors.AlreadyInUse('Transaction', [], 'Another transaction process in progress'));
                        }
                    }
                });
        });
    }

    public async unlock(params: IProcessKey) {
        return new Promise<void>((resolve, reject) => {
            const key = `api:${params.project.id}:transactionProcess:${params.typeOf}:${params.id}`;
            this.redisClient.del([key], (err) => {
                if (err instanceof Error) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }
}

/**
 * 取引中の処理の排他処理を行うミドルウェア
 */
export default (params: {
    typeOf: cinerino.factory.transactionType;
    id: string;
}) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        const processRepo = new TransactionProcessRepository(redisClient);

        try {
            const key: IProcessKey = { ...params, project: req.project };
            await processRepo.lock(key);

            // レスポンスが送信されたら解放
            // @see https://nodejs.org/api/http.html#http_event_finish
            res.on('finish', async () => {
                debug(req.originalUrl, 'res finished. unlocking...');
                await processRepo.unlock(key);
            });

            next();
        } catch (error) {
            next(error);
        }
    };
};
