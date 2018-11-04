/**
 * MongoDBコネクション確立
 */
import * as cinerino from '@cinerino/domain';
import * as createDebug from 'debug';

const debug = createDebug('cinerino-api:connectMongo');
const PING_INTERVAL = 10000;
const connectOptions: cinerino.mongoose.ConnectionOptions = {
    autoReconnect: true,
    keepAlive: 120000,
    connectTimeoutMS: 30000,
    socketTimeoutMS: 0,
    reconnectTries: 30,
    reconnectInterval: 1000,
    useNewUrlParser: true
};

export async function connectMongo(params: {
    defaultConnection: boolean;
}) {
    let connection: cinerino.mongoose.Connection;
    if (params === undefined || params.defaultConnection) {
        // コネクション確立
        await cinerino.mongoose.connect(<string>process.env.MONGOLAB_URI, connectOptions);
        connection = cinerino.mongoose.connection;
    } else {
        connection = cinerino.mongoose.createConnection(<string>process.env.MONGOLAB_URI, connectOptions);
    }

    // 定期的にコネクションチェック
    // tslint:disable-next-line:no-single-line-block-comment
    /* istanbul ignore next */
    setInterval(
        async () => {
            // すでに接続済かどうか
            if (connection.readyState === 1) {
                // 接続済であれば疎通確認
                let pingResult: any;
                try {
                    pingResult = await connection.db.admin().ping();
                    debug('pingResult:', pingResult);
                } catch (error) {
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
                    await cinerino.mongoose.connect(<string>process.env.MONGOLAB_URI, connectOptions);
                } else {
                    connection = cinerino.mongoose.createConnection(<string>process.env.MONGOLAB_URI, connectOptions);
                }
                debug('MongoDB connected!');
            } catch (error) {
                // tslint:disable-next-line:no-console
                console.error('mongoose.connect:', error);
            }
        },
        PING_INTERVAL
    );

    return connection;
}
