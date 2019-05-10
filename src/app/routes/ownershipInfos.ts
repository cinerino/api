/**
 * 所有権ルーター
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';
// tslint:disable-next-line:no-submodule-imports
import { query } from 'express-validator/check';
import * as moment from 'moment';
import * as mongoose from 'mongoose';

import authentication from '../middlewares/authentication';
import permitScopes from '../middlewares/permitScopes';
import validator from '../middlewares/validator';

import * as redis from '../../redis';

const ownershipInfosRouter = Router();
ownershipInfosRouter.use(authentication);

/**
 * コードから所有権に対するアクセストークンを発行する
 */
ownershipInfosRouter.post(
    '/tokens',
    permitScopes(['customer', 'tokens']),
    validator,
    async (req, res, next) => {
        try {
            let token: string;
            const codeRepo = new cinerino.repository.Code(mongoose.connection);
            const tmpCodeRepo = new cinerino.repository.TemporaryCode(redis.getClient());

            try {
                token = await cinerino.service.code.getToken({
                    code: req.body.code,
                    secret: <string>process.env.TOKEN_SECRET,
                    issuer: <string>process.env.RESOURCE_SERVER_IDENTIFIER,
                    // tslint:disable-next-line:no-magic-numbers
                    expiresIn: 1800
                })({ code: codeRepo });
            } catch (error) {
                // コードリポジトリにコードがなければ、一時コードリポジトリで確認
                token = await cinerino.service.code.getToken({
                    code: req.body.code,
                    secret: <string>process.env.TOKEN_SECRET,
                    issuer: <string>process.env.RESOURCE_SERVER_IDENTIFIER,
                    // tslint:disable-next-line:no-magic-numbers
                    expiresIn: 1800
                })({ code: tmpCodeRepo });
            }

            res.json({ token });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * 所有権に対するトークン検証アクションを検索する
 */
ownershipInfosRouter.get(
    '/:id/actions/checkToken',
    permitScopes(['admin']),
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
            const ownershipInfoId = <string>req.params.id;

            const searchConditions: any = {
                typeOf: cinerino.factory.actionType.CheckAction,
                'result.typeOf': {
                    $exists: true,
                    $eq: 'OwnershipInfo'
                },
                'result.id': {
                    $exists: true,
                    $eq: ownershipInfoId
                },
                startDate: {
                    $gte: (req.query.startFrom instanceof Date)
                        ? req.query.startFrom
                        : moment(now)
                            // とりあえずデフォルト直近1カ月(おそらくこれで十分)
                            // tslint:disable-next-line:no-magic-numbers
                            .add(-3, 'months')
                            .toDate(),
                    $lte: (req.query.startThrough instanceof Date)
                        ? req.query.startThrough
                        : now
                }
            };

            const actionRepo = new cinerino.repository.Action(mongoose.connection);

            const totalCount = await actionRepo.actionModel.countDocuments(searchConditions)
                .setOptions({ maxTimeMS: 10000 })
                .exec();

            const actions = await actionRepo.actionModel.find(
                searchConditions,
                {
                    __v: 0,
                    createdAt: 0,
                    updatedAt: 0
                }
            )
                .sort({ startDate: cinerino.factory.sortType.Descending })
                // ページング未実装、いったん100限定でも要件は十分満たされるか
                // tslint:disable-next-line:no-magic-numbers
                .limit(100)
                // .setOptions({ maxTimeMS: 10000 })
                .exec()
                .then((docs) => docs.map((doc) => doc.toObject()));

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
    permitScopes(['customer']),
    (req, __, next) => {
        req.checkQuery('fromDate')
            .notEmpty()
            .isISO8601()
            .withMessage('fromDate must be ISO8601 timestamp');
        req.checkQuery('toDate')
            .notEmpty()
            .isISO8601()
            .withMessage('toDate must be ISO8601 timestamp');

        next();
    },
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
                { 'typeOfGood.typeOf': 'ProgramMembership' }
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
