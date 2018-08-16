// tslint:disable:no-implicit-dependencies
/**
 * expressアプリケーションテスト
 */
import * as clearReuire from 'clear-require';
import { NOT_FOUND, UNAUTHORIZED } from 'http-status';
import * as assert from 'power-assert';
import * as request from 'supertest';

describe('GET /', () => {
    beforeEach(() => {
        delete process.env.BASIC_AUTH_NAME;
        delete process.env.BASIC_AUTH_PASS;
        clearReuire('./app');
    });

    afterEach(() => {
        delete process.env.BASIC_AUTH_NAME;
        delete process.env.BASIC_AUTH_PASS;
    });

    it('ベーシック認証設定がなければ、NOT_FOUNDのはず', async () => {
        // tslint:disable-next-line:no-require-imports
        const app = require('./app');
        await request(app)
            .get('/')
            .set('Accept', 'application/json')
            .expect(NOT_FOUND)
            .then((response) => {
                assert.equal(typeof response.body.error, 'object');
            });
    });

    it('ベーシック認証設定があれば、UNAUTHORIZEDのはず', async () => {
        process.env.BASIC_AUTH_NAME = 'name';
        process.env.BASIC_AUTH_PASS = 'pass';

        // tslint:disable-next-line:no-require-imports
        const app = require('./app');

        await request(app)
            .get('/')
            .set('Accept', 'application/json')
            .expect(UNAUTHORIZED)
            .then((response) => {
                assert.equal(typeof response.body.error, 'object');
            });
    });
});
