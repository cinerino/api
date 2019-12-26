import * as cinerino from '@cinerino/domain';
import * as middlewares from '@motionpicture/express-middleware';

import * as ioredis from 'ioredis';

// tslint:disable-next-line:no-magic-numbers
const UNIT_IN_SECONDS = Number(<string>process.env.TRANSACTION_RATE_LIMIT_UNIT_IN_SECONDS);

// tslint:disable-next-line:no-magic-numbers
const THRESHOLD = Number(<string>process.env.TRANSACTION_RATE_LIMIT_THRESHOLD);

const redisClient = new ioredis({
    host: <string>process.env.REDIS_HOST,
    port: Number(<string>process.env.REDIS_PORT),
    password: <string>process.env.REDIS_KEY,
    tls: (process.env.REDIS_TLS_SERVERNAME !== undefined) ? { servername: process.env.REDIS_TLS_SERVERNAME } : undefined
});

/**
 * 進行中取引の接続回数制限ミドルウェア
 * 取引IDを使用して動的にスコープを作成する
 */
export default (params: {
    typeOf: cinerino.factory.transactionType;
    id: string;
}) => {
    return middlewares.rateLimit({
        redisClient: redisClient,
        aggregationUnitInSeconds: UNIT_IN_SECONDS,
        threshold: THRESHOLD,
        // 制限超過時の動作をカスタマイズ
        limitExceededHandler: (_, __, res, next) => {
            res.setHeader('Retry-After', UNIT_IN_SECONDS);
            const message = `Retry after ${UNIT_IN_SECONDS} seconds for your transaction`;
            next(new cinerino.factory.errors.RateLimitExceeded(message));
        },
        // スコープ生成ロジックをカスタマイズ
        scopeGenerator: (req) => `api:${req.project.id}:rateLimit4transactionInProgress:${params.typeOf}:${params.id}`
    });
};
