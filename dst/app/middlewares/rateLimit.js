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
const cinerino = require("@cinerino/domain");
const middlewares = require("@motionpicture/express-middleware");
const ioredis = require("ioredis");
const USE_RATE_LIMIT = process.env.USE_RATE_LIMIT === '1';
const UNIT_IN_SECONDS = (typeof process.env.RATE_LIMIT_UNIT_IN_SECONDS === 'string') ? Number(process.env.RATE_LIMIT_UNIT_IN_SECONDS) : 1;
// tslint:disable-next-line:no-magic-numbers
const THRESHOLD = (typeof process.env.RATE_LIMIT_THRESHOLD === 'string') ? Number(process.env.RATE_LIMIT_THRESHOLD) : 10;
// tslint:disable-next-line:no-magic-numbers
const THRESHOLD_GET = (typeof process.env.RATE_LIMIT_THRESHOLD_GET === 'string') ? Number(process.env.RATE_LIMIT_THRESHOLD_GET) : 10;
const redisClient = new ioredis({
    host: process.env.REDIS_HOST,
    port: Number(process.env.REDIS_PORT),
    password: process.env.REDIS_KEY,
    tls: (process.env.REDIS_TLS_SERVERNAME !== undefined) ? { servername: process.env.REDIS_TLS_SERVERNAME } : undefined
});
exports.default = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        if (!USE_RATE_LIMIT) {
            next();
            return;
        }
        // 管理者として利用しているかどうか
        if (!req.isProjectMember) {
            next();
            return;
        }
        const routeIdentifier = `${req.baseUrl}${req.path}`;
        const rateLimitScope = (typeof ((_a = req.project) === null || _a === void 0 ? void 0 : _a.id) === 'string')
            ? `api:${req.project.id}:rateLimit:${routeIdentifier}:${req.method}`
            : `api:rateLimit:${routeIdentifier}:${req.method}`;
        yield middlewares.rateLimit({
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
    }
    catch (error) {
        next(error);
    }
});
