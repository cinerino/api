/**
 * 404ハンドラーミドルウェア
 * @module middlewares.notFoundHandler
 */

import * as cinerino from '@cinerino/domain';
import { NextFunction, Request, Response } from 'express';

export default (req: Request, __: Response, next: NextFunction) => {
    next(new cinerino.factory.errors.NotFound(`router for [${req.originalUrl}]`));
};
