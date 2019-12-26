/**
 * 会員必須ミドルウェア
 */
import * as cinerino from '@cinerino/domain';
import * as createDebug from 'debug';
import { NextFunction, Request, Response } from 'express';

const debug = createDebug('cinerino-api:middlewares');

export default (req: Request, __: Response, next: NextFunction) => {
    // 会員としてログイン済みであればOK
    if (isMember(req.user)) {
        debug('logged in as', req.user.sub);
        next();
    } else {
        next(new cinerino.factory.errors.Forbidden('login required'));
    }
};

function isMember(user: Express.IUser) {
    return (user.username !== undefined);
}
