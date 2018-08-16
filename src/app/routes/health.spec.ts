// tslint:disable:no-implicit-dependencies
/**
 * ヘルスチェックルーターテスト
 */
import * as cinerino from '@cinerino/domain';
import * as assert from 'assert';
import * as httpStatus from 'http-status';
import * as supertest from 'supertest';

import * as app from '../../app/app';
import mongooseConnectionOptions from '../../mongooseConnectionOptions';
import * as redis from '../../redis';

const INTERVALS_CHECK_CONNECTION = 2000;

describe('ヘルスチェック', () => {
    beforeEach(async () => {
        await cinerino.mongoose.connect(<string>process.env.MONGOLAB_URI, mongooseConnectionOptions);
    });

    afterEach(async () => {
        await cinerino.mongoose.connect(<string>process.env.MONGOLAB_URI, mongooseConnectionOptions);
    });

    it('mongodbとredisに接続済みであれば健康', async () => {
        await new Promise((resolve, reject) => {
            const timer = setInterval(
                async () => {
                    if (
                        !redis.getClient().connected
                    ) {
                        return;
                    }

                    clearInterval(timer);

                    try {
                        await supertest(app)
                            .get('/health')
                            .set('Accept', 'application/json')
                            .expect(httpStatus.OK)
                            .then((response) => {
                                assert.equal(typeof response.text, 'string');
                            });

                        resolve();
                    } catch (error) {
                        reject(error);
                    }
                },
                INTERVALS_CHECK_CONNECTION
            );
        });
    });

    it('mongodb接続切断後アクセスすればBAD_REQUEST', async () => {
        await cinerino.mongoose.disconnect();
        await supertest(app)
            .get('/health')
            .set('Accept', 'application/json')
            .expect(httpStatus.INTERNAL_SERVER_ERROR)
            .then();
    });
});
