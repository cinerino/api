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

const TOKEN_EXPIRES_IN = 1800;

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
            const ownershipInfoRepo = new cinerino.repository.OwnershipInfo(mongoose.connection);

            const typeOfGood = (req.query.typeOfGood !== undefined && req.query.typeOfGood !== null) ? req.query.typeOfGood : {};
            let ownershipInfos:
                cinerino.factory.ownershipInfo.IOwnershipInfo<cinerino.factory.ownershipInfo.IGoodWithDetail<any>>[];

            const searchConditions: cinerino.factory.ownershipInfo.ISearchConditions = {
                ...req.query,
                project: { id: { $eq: req.project.id } },
                // tslint:disable-next-line:no-magic-numbers
                limit: (req.query.limit !== undefined) ? Math.min(req.query.limit, 100) : 100,
                page: (req.query.page !== undefined) ? Math.max(req.query.page, 1) : 1
            };

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
    permitScopes(['tokens']),
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
    permitScopes(['ownershipInfos.actions.checkToken.read']),
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

            const actionRepo = new cinerino.repository.Action(mongoose.connection);

            const actions = await actionRepo.search(searchConditions);

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

            const repository = new cinerino.repository.OwnershipInfo(mongoose.connection);

            const andConditions: any[] = [
                { 'typeOfGood.typeOf': cinerino.factory.chevre.programMembership.ProgramMembershipType.ProgramMembership }
            ];

            andConditions.push({
                ownedFrom: {
                    $gte: new Date(fromDate),
                    $lte: new Date(toDate)
                }
            });

            if (Array.isArray(theaterIds)) {
                andConditions.push({
                    'acquiredFrom.id': {
                        $exists: true,
                        $in: theaterIds
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
