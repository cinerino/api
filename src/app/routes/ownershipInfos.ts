/**
 * 所有権ルーター
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';
// tslint:disable-next-line:no-implicit-dependencies
import { ParamsDictionary } from 'express-serve-static-core';
import { query } from 'express-validator';
import * as moment from 'moment';
import * as mongoose from 'mongoose';

import permitScopes from '../middlewares/permitScopes';
import rateLimit from '../middlewares/rateLimit';
import validator from '../middlewares/validator';

import { Permission } from '../iam';

const TOKEN_EXPIRES_IN = 1800;

const ownershipInfosRouter = Router();

/**
 * 所有権検索
 */
ownershipInfosRouter.get(
    '',
    permitScopes([Permission.User]),
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
            const ownershipInfoRepo = new cinerino.repository.OwnershipInfo(mongoose.connection);

            const typeOfGood = (req.query.typeOfGood !== undefined && req.query.typeOfGood !== null) ? req.query.typeOfGood : {};
            let ownershipInfos:
                cinerino.factory.ownershipInfo.IOwnershipInfo<cinerino.factory.ownershipInfo.IGoodWithDetail<any>>[];

            const searchConditions: cinerino.factory.ownershipInfo.ISearchConditions<any> = {
                ...req.query,
                project: { ids: [req.project.id] },
                // tslint:disable-next-line:no-magic-numbers
                limit: (req.query.limit !== undefined) ? Math.min(req.query.limit, 100) : 100,
                page: (req.query.page !== undefined) ? Math.max(req.query.page, 1) : 1
            };

            const totalCount = await ownershipInfoRepo.count(searchConditions);

            switch (typeOfGood.typeOf) {
                // case cinerino.factory.ownershipInfo.AccountGoodType.Account:
                //     ownershipInfos = await cinerino.service.account.search({
                //         project: req.project,
                //         conditions: searchConditions
                //     })({
                //         ownershipInfo: ownershipInfoRepo,
                //         project: projectRepo
                //     });

                //     break;

                // case cinerino.factory.chevre.reservationType.EventReservation:
                //     ownershipInfos = await cinerino.service.reservation.searchScreeningEventReservations(searchConditions)({
                //         ownershipInfo: ownershipInfoRepo,
                //         project: projectRepo
                //     });
                //     break;

                default:
                    ownershipInfos = await ownershipInfoRepo.search(searchConditions);
            }

            res.set('X-Total-Count', totalCount.toString());
            res.json(ownershipInfos);
        } catch (error) {
            next(error);
        }
    }
);

/**
 * コードから所有権に対するアクセストークンを発行する
 */
ownershipInfosRouter.post(
    '/tokens',
    permitScopes([Permission.User, 'customer', 'tokens']),
    rateLimit,
    validator,
    async (req, res, next) => {
        try {
            const codeRepo = new cinerino.repository.Code(mongoose.connection);

            const token = await cinerino.service.code.getToken({
                code: req.body.code,
                secret: <string>process.env.TOKEN_SECRET,
                issuer: <string>process.env.RESOURCE_SERVER_IDENTIFIER,
                expiresIn: TOKEN_EXPIRES_IN
            })({ code: codeRepo });

            res.json({ token });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * 所有権に対するトークン検証アクションを検索する
 */
// tslint:disable-next-line:use-default-type-parameter
ownershipInfosRouter.get<ParamsDictionary>(
    '/:id/actions/checkToken',
    permitScopes([Permission.User]),
    rateLimit,
    ...[
        query('startFrom')
            .optional()
            .isISO8601()
            .toDate(),
        query('startThrough')
            .optional()
            .isISO8601()
            .toDate()
    ],
    validator,
    async (req, res, next) => {
        try {
            const now = new Date();
            const ownershipInfoId = req.params.id;

            const searchConditions: cinerino.factory.action.ISearchConditions<cinerino.factory.actionType.CheckAction> = {
                // ページング未実装、いったん100限定でも要件は十分満たされるか
                // tslint:disable-next-line:no-magic-numbers
                limit: 100,
                sort: { startDate: cinerino.factory.sortType.Descending },
                typeOf: cinerino.factory.actionType.CheckAction,
                result: {
                    typeOf: { $in: ['OwnershipInfo'] },
                    id: { $in: [ownershipInfoId] }
                },
                startFrom: (req.query.startFrom instanceof Date)
                    ? req.query.startFrom
                    : moment(now)
                        // とりあえずデフォルト直近1カ月(おそらくこれで十分)
                        // tslint:disable-next-line:no-magic-numbers
                        .add(-3, 'months')
                        .toDate(),
                startThrough: (req.query.startThrough instanceof Date)
                    ? req.query.startThrough
                    : now
            };

            // const searchConditions: any = {
            //     typeOf: cinerino.factory.actionType.CheckAction,
            //     'result.typeOf': {
            //         $exists: true,
            //         $eq: 'OwnershipInfo'
            //     },
            //     'result.id': {
            //         $exists: true,
            //         $eq: ownershipInfoId
            //     },
            //     startDate: {
            //         $gte: (req.query.startFrom instanceof Date)
            //             ? req.query.startFrom
            //             : moment(now)
            //                 // とりあえずデフォルト直近1カ月(おそらくこれで十分)
            //                 // tslint:disable-next-line:no-magic-numbers
            //                 .add(-3, 'months')
            //                 .toDate(),
            //         $lte: (req.query.startThrough instanceof Date)
            //             ? req.query.startThrough
            //             : now
            //     }
            // };

            const actionRepo = new cinerino.repository.Action(mongoose.connection);

            // const totalCount = await actionRepo.actionModel.countDocuments(searchConditions)
            //     .setOptions({ maxTimeMS: 10000 })
            //     .exec();

            const totalCount = await actionRepo.count(searchConditions);

            const actions = await actionRepo.search(searchConditions);

            // const actions = await actionRepo.actionModel.find(
            //     searchConditions,
            //     {
            //         __v: 0,
            //         createdAt: 0,
            //         updatedAt: 0
            //     }
            // )
            //     .sort({ startDate: cinerino.factory.sortType.Descending })
            //     // ページング未実装、いったん100限定でも要件は十分満たされるか
            //     // tslint:disable-next-line:no-magic-numbers
            //     .limit(100)
            //     // .setOptions({ maxTimeMS: 10000 })
            //     .exec()
            //     .then((docs) => docs.map((doc) => doc.toObject()));

            res.set('X-Total-Count', totalCount.toString());
            res.json(actions);
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
    permitScopes([Permission.User, 'customer']),
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

            const searchConditions = {
                createdAtFrom: new Date(fromDate),
                createdAtTo: new Date(toDate),
                theaterIds: theaterIds
            };

            const repository = new cinerino.repository.OwnershipInfo(mongoose.connection);

            const andConditions: any[] = [
                { 'typeOfGood.typeOf': cinerino.factory.programMembership.ProgramMembershipType.ProgramMembership }
            ];

            andConditions.push({
                createdAt: {
                    $lte: searchConditions.createdAtTo,
                    $gte: searchConditions.createdAtFrom
                }
            });

            if (Array.isArray(searchConditions.theaterIds)) {
                andConditions.push({
                    'acquiredFrom.id': {
                        $exists: true,
                        $in: searchConditions.theaterIds
                    }
                });
            }

            const count = await repository.ownershipInfoModel.countDocuments({ $and: andConditions })
                .exec();

            res.json({ count });
        } catch (error) {
            next(error);
        }
    }
);

export default ownershipInfosRouter;
