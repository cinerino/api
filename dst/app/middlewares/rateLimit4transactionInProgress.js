"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const cinerino = require("@cinerino/domain");
const middlewares = require("@motionpicture/express-middleware");
const ioredis = require("ioredis");
// tslint:disable-next-line:no-magic-numbers
const UNIT_IN_SECONDS = Number(process.env.TRANSACTION_RATE_LIMIT_UNIT_IN_SECONDS);
// tslint:disable-next-line:no-magic-numbers
const THRESHOLD = Number(process.env.TRANSACTION_RATE_LIMIT_THRESHOLD);
const redisClient = new ioredis({
    host: process.env.REDIS_HOST,
    port: Number(process.env.REDIS_PORT),
    password: process.env.REDIS_KEY,
    tls: (process.env.REDIS_TLS_SERVERNAME !== undefined) ? { servername: process.env.REDIS_TLS_SERVERNAME } : undefined
});
/**
 * 進行中取引の接続回数制限ミドルウェア
 * 取引IDを使用して動的にスコープを作成する
 */
exports.default = (params) => {
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
        scopeGenerator: (_) => `api:rateLimit4transactionInProgress:${params.typeOf}:${params.id}`
    });
};
