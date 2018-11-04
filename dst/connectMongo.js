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
 * MongoDBコネクション確立
 */
const cinerino = require("@cinerino/domain");
const createDebug = require("debug");
const debug = createDebug('cinerino-api:connectMongo');
const PING_INTERVAL = 10000;
const connectOptions = {
    autoReconnect: true,
    keepAlive: 120000,
    connectTimeoutMS: 30000,
    socketTimeoutMS: 0,
    reconnectTries: 30,
    reconnectInterval: 1000,
    useNewUrlParser: true
};
function connectMongo(params) {
    return __awaiter(this, void 0, void 0, function* () {
        let connection;
        if (params === undefined || params.defaultConnection) {
            // コネクション確立
            yield cinerino.mongoose.connect(process.env.MONGOLAB_URI, connectOptions);
            connection = cinerino.mongoose.connection;
        }
        else {
            connection = cinerino.mongoose.createConnection(process.env.MONGOLAB_URI, connectOptions);
        }
        // 定期的にコネクションチェック
        // tslint:disable-next-line:no-single-line-block-comment
        /* istanbul ignore next */
        setInterval(() => __awaiter(this, void 0, void 0, function* () {
            // すでに接続済かどうか
            if (connection.readyState === 1) {
                // 接続済であれば疎通確認
                let pingResult;
                try {
                    pingResult = yield connection.db.admin().ping();
                    debug('pingResult:', pingResult);
                }
                catch (error) {
                    // tslint:disable-next-line:no-console
                    console.error('ping:', error);
                }
                // 疎通確認結果が適性であれば何もしない
                if (pingResult !== undefined && pingResult.ok === 1) {
                    return;
                }
            }
            // コネクション確立
            try {
                if (params === undefined || params.defaultConnection) {
                    // コネクション確立
                    yield cinerino.mongoose.connect(process.env.MONGOLAB_URI, connectOptions);
                }
                else {
                    connection = cinerino.mongoose.createConnection(process.env.MONGOLAB_URI, connectOptions);
                }
                debug('MongoDB connected!');
            }
            catch (error) {
                // tslint:disable-next-line:no-console
                console.error('mongoose.connect:', error);
            }
        }), PING_INTERVAL);
        return connection;
    });
}
exports.connectMongo = connectMongo;
