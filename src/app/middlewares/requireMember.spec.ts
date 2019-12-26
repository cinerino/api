// tslint:disable:no-implicit-dependencies
/**
 * 会員必須ミドルウェアテスト
 */
import * as cinerino from '@cinerino/domain';
import * as assert from 'assert';
import * as nock from 'nock';
import * as sinon from 'sinon';

import * as requireMember from './requireMember';

let sandbox: sinon.SinonSandbox;

describe('requireMember.default()', () => {
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

    it('会員であればnextが呼ばれるはず', async () => {
        const params = {
            req: { user: { username: 'username' } },
            res: {},
            next: () => undefined
        };

        sandbox.mock(params).expects('next').once().withExactArgs();

        const result = await requireMember.default(<any>params.req, <any>params.res, params.next);
        assert.equal(result, undefined);
        sandbox.verify();
    });

    it('会員でなければforbiddenエラーと共にnextが呼ばれるはず', async () => {
        const params = {
            req: { user: {} },
            res: {},
            next: () => undefined
        };

        sandbox.mock(params).expects('next').once().withExactArgs(sinon.match.instanceOf(cinerino.factory.errors.Forbidden));

        const result = await requireMember.default(<any>params.req, <any>params.res, params.next);
        assert.equal(result, undefined);
        sandbox.verify();
    });
});
