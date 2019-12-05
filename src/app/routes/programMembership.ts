/**
 * 会員プログラムルーター
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';
import * as mongoose from 'mongoose';

import permitScopes from '../middlewares/permitScopes';
import rateLimit from '../middlewares/rateLimit';
import validator from '../middlewares/validator';

const programMembershipsRouter = Router();

programMembershipsRouter.get(
    '',
    permitScopes(['customer', 'programMemberships', 'programMemberships.read-only']),
    rateLimit,
    validator,
    async (__, res, next) => {
        try {
            const repository = new cinerino.repository.ProgramMembership(mongoose.connection);
            const programMemberships = await repository.search({});
            res.json(programMemberships);
        } catch (error) {
            next(error);
        }
    }
);

export default programMembershipsRouter;
