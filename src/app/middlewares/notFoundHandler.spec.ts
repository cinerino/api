// tslint:disable:no-implicit-dependencies
/**
 * not foundハンドラーミドルウェアテスト
 */
import * as cinerino from '@cinerino/domain';
import * as assert from 'assert';
import * as nock from 'nock';
import * as sinon from 'sinon';

import * as notFoundHandler from './notFoundHandler';

let sandbox: sinon.SinonSandbox;

describe('notFoundHandler.default()', () => {
    beforeEach(() => {
        nock.cleanAll();
        nock.disableNetConnect();
        sandbox = sinon.sandbox.create();
    });

    afterEach(() => {
        nock.cleanAll();
        nock.enableNetConnect();
        sandbox.restore();
    });

    it('NotFoundエラーと共にnextが呼ばれるはず', async () => {
        const params = {
            req: {},
            res: {},
            next: () => undefined
        };

        sandbox.mock(params).expects('next').once().withExactArgs(sinon.match.instanceOf(cinerino.factory.errors.NotFound));

        const result = await notFoundHandler.default(<any>params.req, <any>params.res, params.next);
        assert.equal(result, undefined);
        sandbox.verify();
    });
});
