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
 * 注文配送
 */
const cinerino = require("@cinerino/domain");
const connectMongo_1 = require("../../../connectMongo");
exports.default = () => __awaiter(this, void 0, void 0, function* () {
    const connection = yield connectMongo_1.connectMongo({ defaultConnection: false });
    const redisClient = cinerino.redis.createClient({
        host: process.env.REDIS_HOST,
        // tslint:disable-next-line:no-magic-numbers
        port: parseInt(process.env.REDIS_PORT, 10),
        password: process.env.REDIS_KEY,
        tls: { servername: process.env.REDIS_HOST }
    });
    const chevreAuthClient = new cinerino.chevre.auth.ClientCredentials({
        domain: process.env.CHEVRE_AUTHORIZE_SERVER_DOMAIN,
        clientId: process.env.CHEVRE_CLIENT_ID,
        clientSecret: process.env.CHEVRE_CLIENT_SECRET,
        scopes: [],
        state: ''
    });
    let count = 0;
    const MAX_NUBMER_OF_PARALLEL_TASKS = 10;
    const INTERVAL_MILLISECONDS = 200;
    const taskRepo = new cinerino.repository.Task(connection);
    setInterval(() => __awaiter(this, void 0, void 0, function* () {
        if (count > MAX_NUBMER_OF_PARALLEL_TASKS) {
            return;
        }
        count += 1;
        try {
            yield cinerino.service.task.executeByName(cinerino.factory.taskName.SendOrder)({
                taskRepo: taskRepo,
                connection: connection,
                redisClient: redisClient,
                chevreEndpoint: process.env.CHEVRE_ENDPOINT,
                chevreAuthClient: chevreAuthClient
            });
        }
        catch (error) {
            console.error(error);
        }
        count -= 1;
    }), INTERVAL_MILLISECONDS);
});
