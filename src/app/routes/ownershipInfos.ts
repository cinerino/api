/**
 * 所有権ルーター
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';
// tslint:disable-next-line:no-implicit-dependencies
// import { ParamsDictionary } from 'express-serve-static-core';
import { query } from 'express-validator';
// import * as moment from 'moment';

import permitScopes from '../middlewares/permitScopes';
import rateLimit from '../middlewares/rateLimit';
import validator from '../middlewares/validator';

const chevreAuthClient = new cinerino.chevre.auth.ClientCredentials({
    domain: <string>process.env.CHEVRE_AUTHORIZE_SERVER_DOMAIN,
    clientId: <string>process.env.CHEVRE_CLIENT_ID,
    clientSecret: <string>process.env.CHEVRE_CLIENT_SECRET,
    scopes: [],
    state: ''
});

const ownershipInfosRouter = Router();

/**
 * 所有権検索
 */
ownershipInfosRouter.get(
    '',
    permitScopes(['ownershipInfos.read']),
    rateLimit,
    ...[
        query('ownedFrom')
            .optional()
            .isISO8601()
            .toDate(),
        query('ownedThrough')
            .optional()
            .isISO8601()
            .toDate()
    ],
    validator,
    async (req, res, next) => {
        try {
            const ownershipInfoService = new cinerino.chevre.service.OwnershipInfo({
                endpoint: cinerino.credentials.chevre.endpoint,
                auth: chevreAuthClient,
                project: { id: req.project.id }
            });

            const typeOfGood = (req.query.typeOfGood !== undefined && req.query.typeOfGood !== null) ? req.query.typeOfGood : {};
            let ownershipInfos: cinerino.factory.ownershipInfo.IOwnershipInfo<cinerino.factory.ownershipInfo.IGoodWithDetail>[]
                | cinerino.factory.ownershipInfo.IOwnershipInfo<cinerino.factory.ownershipInfo.IGood>[];

            const searchConditions: cinerino.factory.ownershipInfo.ISearchConditions = {
                ...req.query,
                project: { id: { $eq: req.project.id } },
                // tslint:disable-next-line:no-magic-numbers
                limit: (req.query.limit !== undefined) ? Math.min(req.query.limit, 100) : 100,
                page: (req.query.page !== undefined) ? Math.max(req.query.page, 1) : 1
            };

            switch (typeOfGood.typeOf) {
                default:
                    const searchOwnershipInfosResult = await ownershipInfoService.search(searchConditions);
                    ownershipInfos = searchOwnershipInfosResult.data;
            }

            res.json(ownershipInfos);
        } catch (error) {
            next(error);
        }
    }
);

/**
 * Cinemasunshine対応
 * @deprecated
 */
ownershipInfosRouter.get(
    '/countByRegisterDateAndTheater',
    permitScopes(['ownershipInfos.read']),
    rateLimit,
    ...[
        query('fromDate')
            .not()
            .isEmpty()
            .isISO8601(),
        query('toDate')
            .not()
            .isEmpty()
            .isISO8601()
    ],
    validator,
    async (req, res, next) => {
        try {
            const fromDate: string = req.query.fromDate;
            const toDate: string = req.query.toDate;
            const theaterIds: string[] = req.query.theaterIds;

            const ownershipInfoService = new cinerino.chevre.service.OwnershipInfo({
                endpoint: cinerino.credentials.chevre.endpoint,
                auth: chevreAuthClient,
                project: { id: req.project.id }
            });

            // const andConditions: any[] = [
            //     { 'typeOfGood.typeOf': cinerino.factory.programMembership.ProgramMembershipType.ProgramMembership }
            // ];

            // andConditions.push({
            //     ownedFrom: {
            //         $gte: new Date(fromDate),
            //         $lte: new Date(toDate)
            //     }
            // });

            // if (Array.isArray(theaterIds)) {
            //     andConditions.push({
            //         'acquiredFrom.id': {
            //             $exists: true,
            //             $in: theaterIds
            //         }
            //     });
            // }

            // const count = await ownershipInfoService.countDocuments({ $and: andConditions })
            //     .exec();
            const searchOwnershipInfosResult = await ownershipInfoService.search({
                project: { id: { $eq: req.project.id } },
                typeOfGood: { typeOf: { $eq: cinerino.factory.programMembership.ProgramMembershipType.ProgramMembership } },
                countDocuments: '1',
                ownedFromGte: new Date(fromDate),
                ownedFromLte: new Date(toDate),
                ...(Array.isArray(theaterIds))
                    ? { acquiredFrom: { id: { $in: theaterIds } } }
                    : undefined
            });
            const count = Number(searchOwnershipInfosResult.totalCount);

            res.json({ count });
        } catch (error) {
            next(error);
        }
    }
);

export default ownershipInfosRouter;
