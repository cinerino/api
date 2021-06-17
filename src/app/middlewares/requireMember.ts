/**
 * 会員必須ミドルウェア
 */
import * as cinerino from '@cinerino/domain';
import { NextFunction, Request, Response } from 'express';

export default (req: Request, __: Response, next: NextFunction) => {
    // 会員としてログイン済みであればOK
    if (isMember(req)) {
        next();
    } else {
        next(new cinerino.factory.errors.Forbidden('login required'));
    }
};

function isMember(req: Request) {
    // req.canReadPeopleMeで判定
    return req.canReadPeopleMe === true && typeof req.user.username === 'string';
}
