/**
 * バリデーターミドルウェア
 * リクエストのパラメータ(query strings or body parameters)に対するバリデーション
 */
import * as cinerino from '@cinerino/domain';
import { NextFunction, Request, Response } from 'express';
import { } from 'express-validator'; // 型を読み込んでおかないとテストコードでコンパイルエラー発生
// tslint:disable-next-line:no-submodule-imports
import { validationResult } from 'express-validator/check';
import { BAD_REQUEST } from 'http-status';

import { APIError } from '../error/api';

export default async (req: Request, __: Response, next: NextFunction) => {
    const validatorResult = validationResult(req);
    if (!validatorResult.isEmpty()) {
        const errors = validatorResult.array()
            .map((mappedRrror) => {
                return new cinerino.factory.errors.Argument(mappedRrror.param, mappedRrror.msg);
            });

        next(new APIError(BAD_REQUEST, errors));
    } else {
        next();
    }
};
