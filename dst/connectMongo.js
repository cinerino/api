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
exports.connectMongo = void 0;
/**
 * MongoDBコネクション確立
 */
const cinerino = require("@cinerino/domain");
const createDebug = require("debug");
const mongoose = require("mongoose");
const debug = createDebug('cinerino-api:connectMongo');
const MONGOLAB_URI = process.env.MONGOLAB_URI;
const AUTO_INDEX = process.env.MONGO_AUTO_INDEX_DISABLED !== '1';
const MONGO_PING_INTERVAL_MS = (typeof process.env.MONGO_PING_INTERVAL_MS === 'string')
    ? Number(process.env.MONGO_PING_INTERVAL_MS)
    // tslint:disable-next-line:no-magic-numbers
    : 30000;
// tslint:disable-next-line:no-magic-numbers
const MONGO_PING_TIMEOUT_MS = (typeof process.env.MONGO_PING_TIMEOUT_MS === 'string') ? Number(process.env.MONGO_PING_TIMEOUT_MS) : 10000;
const connectOptions = {
    autoIndex: AUTO_INDEX,
    // autoReconnect: true,
    keepAlive: true,
    connectTimeoutMS: 30000,
    socketTimeoutMS: 45000,
    // reconnectTries: 30,
    // reconnectInterval: 1000,
    useCreateIndex: true,
    useFindAndModify: false,
    useNewUrlParser: true,
    useUnifiedTopology: true
};
function connectMongo(params) {
    return __awaiter(this, void 0, void 0, function* () {
        let connection;
        if (params === undefined || params.defaultConnection) {
            // コネクション確立
            yield mongoose.connect(MONGOLAB_URI, connectOptions);
            connection = mongoose.connection;
        }
        else {
            connection = mongoose.createConnection(MONGOLAB_URI, connectOptions);
        }
        // 定期的にコネクションチェック
        // tslint:disable-next-line:no-single-line-block-comment
        /* istanbul ignore next */
        if (params.disableCheck === undefined || params.disableCheck === false) {
            setInterval(() => __awaiter(this, void 0, void 0, function* () {
                // すでに接続済かどうか
                if (connection.readyState === 1) {
                    // 接続済であれば疎通確認
                    let pingResult;
                    yield new Promise((resolve) => {
                        try {
                            connection.db.admin()
                                .ping()
                                .then((result) => {
                                pingResult = result;
                                debug('pingResult:', pingResult);
                            })
                                .catch((error) => {
                                // tslint:disable-next-line:no-console
                                console.error('ping error:', error);
                            });
                        }
                        catch (error) {
                            // tslint:disable-next-line:no-console
                            console.error('connection.db.admin() error:', error);
                        }
                        // tslint:disable-next-line:no-magic-numbers
                        setTimeout(() => { resolve(); }, MONGO_PING_TIMEOUT_MS);
                    });
                    // 疎通確認結果が適性であれば何もしない
                    if (pingResult !== undefined && pingResult.ok === 1) {
                        return;
                    }
                }
                try {
                    // コネクション再確立
                    yield connection.close();
                    yield connection.openUri(MONGOLAB_URI, connectOptions);
                    debug('MongoDB reconnected!');
                    yield cinerino.service.notification.report2developers(`api:connectMongo`, 'MongoDB connection reestablished!')();
                }
                catch (error) {
                    // tslint:disable-next-line:no-console
                    console.error('mongoose.connect:', error);
                    yield cinerino.service.notification.report2developers(`api:connectMongo`, `MongoDB connection error: ${error.stack}`)();
                }
            }), MONGO_PING_INTERVAL_MS);
        }
        return connection;
    });
}
exports.connectMongo = connectMongo;
