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

/**
 * 会員プログラム検索
 */
programMembershipsRouter.get(
    '',
    permitScopes(['programMemberships.*', 'programMemberships.read']),
    rateLimit,
    validator,
    async (req, res, next) => {
        try {
            const programMembershipRepo = new cinerino.repository.ProgramMembership(mongoose.connection);

            const searchConditions: cinerino.factory.programMembership.ISearchConditions = {
                ...req.query,
                project: { id: { $eq: req.project.id } },
                // tslint:disable-next-line:no-magic-numbers
                limit: (req.query.limit !== undefined) ? Math.min(req.query.limit, 100) : 100,
                page: (req.query.page !== undefined) ? Math.max(req.query.page, 1) : 1
            };

            let programMemberships = await programMembershipRepo.search(searchConditions);

            // api使用側への互換性維持のため、price属性を補完
            programMemberships = programMemberships.map((p) => {
                const offers = p.offers?.map((o) => {
                    return {
                        ...o,
                        price: o.priceSpecification?.price
                    };
                });

                return {
                    ...p,
                    ...(Array.isArray(offers)) ? { offers } : undefined
                };
            });

            res.json(programMemberships);
        } catch (error) {
            next(error);
        }
    }
);

export default programMembershipsRouter;
