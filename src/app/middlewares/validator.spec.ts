// tslint:disable:no-implicit-dependencies
/**
 * バリデーションミドルウェアテスト
 */
import * as assert from 'assert';
// tslint:disable-next-line:no-submodule-imports
import * as checkAPI from 'express-validator/check';
import * as nock from 'nock';
import * as sinon from 'sinon';

import { APIError } from '../error/api';
import validator from './validator';

let sandbox: sinon.SinonSandbox;

describe('validator', () => {
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

    it('バリエーションエラーがなければnextが呼ばれるはず', async () => {
        const validatorResult = {
            isEmpty: () => undefined
        };
        const params = {
            req: {},
            res: {},
            next: () => undefined
        };

        sandbox.mock(checkAPI)
            .expects('validationResult')
            .once()
            .returns(validatorResult);
        sandbox.mock(validatorResult)
            .expects('isEmpty')
            .once()
            .returns(true);
        sandbox.mock(params)
            .expects('next')
            .once()
            .withExactArgs();

        const result = await validator(<any>params.req, <any>params.res, params.next);
        assert.equal(result, undefined);
        sandbox.verify();
    });

    it('バリエーションエラーがあればAPIErrorと共にnextが呼ばれるはず', async () => {
        const validatorResult = {
            isEmpty: () => undefined,
            array: () => [{ param: 'param', msg: 'msg' }]
        };
        const params = {
            req: {},
            res: {},
            next: () => undefined
        };

        sandbox.mock(checkAPI)
            .expects('validationResult')
            .once()
            .returns(validatorResult);
        sandbox.mock(validatorResult)
            .expects('isEmpty')
            .once()
            .returns(false);
        sandbox.mock(params)
            .expects('next')
            .once()
            .withExactArgs(sinon.match.instanceOf(APIError));

        const result = await validator(<any>params.req, <any>params.res, params.next);
        assert.equal(result, undefined);
        sandbox.verify();
    });
});
