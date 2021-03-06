import * as cinerino from '@cinerino/domain';
import * as middlewares from '@motionpicture/express-middleware';
import { NextFunction, Request, Response } from 'express';

import * as ioredis from 'ioredis';

const USE_RATE_LIMIT = process.env.USE_RATE_LIMIT === '1';
const UNIT_IN_SECONDS = (typeof process.env.RATE_LIMIT_UNIT_IN_SECONDS === 'string') ? Number(process.env.RATE_LIMIT_UNIT_IN_SECONDS) : 1;
// tslint:disable-next-line:no-magic-numbers
const THRESHOLD = (typeof process.env.RATE_LIMIT_THRESHOLD === 'string') ? Number(process.env.RATE_LIMIT_THRESHOLD) : 10;
// tslint:disable-next-line:no-magic-numbers
const THRESHOLD_GET = (typeof process.env.RATE_LIMIT_THRESHOLD_GET === 'string') ? Number(process.env.RATE_LIMIT_THRESHOLD_GET) : 10;

const redisClient = new ioredis({
    host: <string>process.env.REDIS_HOST,
    port: Number(<string>process.env.REDIS_PORT),
    password: <string>process.env.REDIS_KEY,
    tls: (process.env.REDIS_TLS_SERVERNAME !== undefined) ? { servername: process.env.REDIS_TLS_SERVERNAME } : undefined
});

export default async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!USE_RATE_LIMIT) {
            next();

            return;
        }

        // 管理者として利用しているかどうか
        if (!req.isAdmin) {
            next();

            return;
        }

        const routeIdentifier = `${req.baseUrl}${req.path}`;
        const rateLimitScope = (typeof req.project?.id === 'string')
            ? `api:${req.project.id}:rateLimit:${routeIdentifier}:${req.method}`
            : `api:rateLimit:${routeIdentifier}:${req.method}`;

        await middlewares.rateLimit({
            redisClient: redisClient,
            aggregationUnitInSeconds: UNIT_IN_SECONDS,
            threshold: (req.method === 'GET') ? THRESHOLD_GET : THRESHOLD,
            // 制限超過時の動作をカスタマイズ
            limitExceededHandler: (_, __, resOnLimitExceeded, nextOnLimitExceeded) => {
                resOnLimitExceeded.setHeader('Retry-After', UNIT_IN_SECONDS);
                const message = `Retry after ${UNIT_IN_SECONDS} seconds`;
                nextOnLimitExceeded(new cinerino.factory.errors.RateLimitExceeded(message));
            },
            // スコープ生成ロジックをカスタマイズ
            scopeGenerator: () => rateLimitScope
        })(req, res, next);
    } catch (error) {
        next(error);
    }
};
