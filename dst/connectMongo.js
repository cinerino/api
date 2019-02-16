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
const mongoose = require("mongoose");
const debug = createDebug('cinerino-api:connectMongo');
const PING_INTERVAL = 10000;
const MONGOLAB_URI = process.env.MONGOLAB_URI;
const connectOptions = {
    autoReconnect: true,
    keepAlive: true,
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
            yield mongoose.connect(MONGOLAB_URI, connectOptions);
            connection = mongoose.connection;
        }
        else {
            connection = mongoose.createConnection(MONGOLAB_URI, connectOptions);
        }
        // 定期的にコネクションチェック
        // tslint:disable-next-line:no-single-line-block-comment
        /* istanbul ignore next */
        setInterval(() => __awaiter(this, void 0, void 0, function* () {
            // すでに接続済かどうか
            if (connection.readyState === 1) {
                // 接続済であれば疎通確認
                let pingResult;
                yield new Promise((resolve) => __awaiter(this, void 0, void 0, function* () {
                    try {
                        pingResult = yield connection.db.admin()
                            .ping();
                        debug('pingResult:', pingResult);
                    }
                    catch (error) {
                        // tslint:disable-next-line:no-console
                        console.error('ping:', error);
                    }
                    // tslint:disable-next-line:no-magic-numbers
                    setTimeout(() => { resolve(); }, 5000);
                }));
                // 疎通確認結果が適性であれば何もしない
                if (pingResult !== undefined && pingResult.ok === 1) {
                    return;
                }
            }
            try {
                // コネクション再確立
                yield connection.close();
                yield connection.openUri(MONGOLAB_URI, undefined, undefined, connectOptions);
                debug('MongoDB reconnected!');
                yield cinerino.service.notification.report2developers(`[${process.env.PROJECT_ID}] api:connectMongo`, 'MongoDB connection reestablished!')();
            }
            catch (error) {
                // tslint:disable-next-line:no-console
                console.error('mongoose.connect:', error);
                yield cinerino.service.notification.report2developers(`[${process.env.PROJECT_ID}] api:connectMongo`, `MongoDB connection error: ${error.stack}`)();
            }
        }), PING_INTERVAL);
        return connection;
    });
}
exports.connectMongo = connectMongo;
