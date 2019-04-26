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
 * ムビチケ着券取消
 */
const cinerino = require("@cinerino/domain");
const connectMongo_1 = require("../../../connectMongo");
exports.default = (params) => __awaiter(this, void 0, void 0, function* () {
    const connection = yield connectMongo_1.connectMongo({ defaultConnection: false });
    let count = 0;
    const MAX_NUBMER_OF_PARALLEL_TASKS = 10;
    const INTERVAL_MILLISECONDS = 1000;
    const taskRepo = new cinerino.repository.Task(connection);
    const authClient = new cinerino.mvtkreserveapi.auth.ClientCredentials({
        domain: process.env.MVTK_RESERVE_AUTHORIZE_SERVER_DOMAIN,
        clientId: process.env.MVTK_RESERVE_CLIENT_ID,
        clientSecret: process.env.MVTK_RESERVE_CLIENT_SECRET,
        scopes: [],
        state: ''
    });
    setInterval(() => __awaiter(this, void 0, void 0, function* () {
        if (count > MAX_NUBMER_OF_PARALLEL_TASKS) {
            return;
        }
        count += 1;
        try {
            yield cinerino.service.task.executeByName({
                project: params.project,
                name: cinerino.factory.taskName.RefundMovieTicket
            })({
                taskRepo: taskRepo,
                connection: connection,
                mvtkReserveEndpoint: process.env.MVTK_RESERVE_ENDPOINT,
                mvtkReserveAuthClient: authClient
            });
        }
        catch (error) {
            console.error(error);
        }
        count -= 1;
    }), INTERVAL_MILLISECONDS);
});
