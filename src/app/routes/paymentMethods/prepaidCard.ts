/**
 * プリペイドカードルーター
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';
import { body, query } from 'express-validator';
import { CREATED } from 'http-status';
import * as moment from 'moment-timezone';
import * as mongoose from 'mongoose';

import * as redis from '../../../redis';

import permitScopes from '../../middlewares/permitScopes';
import rateLimit from '../../middlewares/rateLimit';
import validator from '../../middlewares/validator';

const prepaidCardPaymentMethodsRouter = Router();

/**
 * プリペイドカード作成
 */
prepaidCardPaymentMethodsRouter.post(
    '',
    permitScopes(['paymentMethods.PrepaidCard.*', 'paymentMethods.PrepaidCard.create']),
    rateLimit,
    ...[
        body('name')
            .not()
            .isEmpty()
            .isString(),
        body('accessCode')
            .not()
            .isEmpty()
            .isString()
    ],
    validator,
    async (req, res, next) => {
        try {
            // 口座作成
            const account = await cinerino.service.account.openWithoutOwnershipInfo({
                project: { typeOf: req.project.typeOf, id: req.project.id },
                accountType: cinerino.factory.accountType.Prepaid,
                name: req.body.name
            })({
                accountNumber: new cinerino.repository.AccountNumber(redis.getClient()),
                project: new cinerino.repository.Project(mongoose.connection)
            });

            // アクセスコードを作成
            const accessCode = req.body.accessCode;

            // プリペイドカード作成
            const paymentMethodRepo = new cinerino.repository.PaymentMethod(mongoose.connection);

            const prepaidCard: cinerino.factory.paymentMethod.paymentCard.prepaidCard.IPrepaidCard = {
                project: { typeOf: req.project.typeOf, id: req.project.id },
                typeOf: cinerino.factory.paymentMethodType.PrepaidCard,
                identifier: account.accountNumber,
                accessCode: accessCode,
                amount: {
                    typeOf: 'MonetaryAmount',
                    currency: cinerino.factory.priceCurrency.JPY,
                    validFrom: moment(account.openDate)
                        .toDate()
                },
                name: account.name
            };

            const doc = await paymentMethodRepo.paymentMethodModel.create(prepaidCard);

            res.status(CREATED)
                .json(doc.toObject());
        } catch (error) {
            next(error);
        }
    }
);

/**
 * プリペイドカード検索
 */
prepaidCardPaymentMethodsRouter.get(
    '',
    permitScopes(['paymentMethods.*', 'paymentMethods.read']),
    rateLimit,
    ...[
        query('limit')
            .optional()
            .isInt()
            .toInt(),
        query('page')
            .optional()
            .isInt()
            .toInt()
    ],
    validator,
    async (req, res, next) => {
        try {
            const paymentMethodRepo = new cinerino.repository.PaymentMethod(mongoose.connection);

            const searchConditions: cinerino.factory.paymentMethod.ISearchConditions<cinerino.factory.paymentMethodType.PrepaidCard> = {
                ...req.query,
                project: { ids: [req.project.id] },
                // tslint:disable-next-line:no-magic-numbers
                limit: (req.query.limit !== undefined) ? Math.min(req.query.limit, 100) : 100,
                page: (req.query.page !== undefined) ? Math.max(req.query.page, 1) : 1,
                typeOf: { $eq: cinerino.factory.paymentMethodType.PrepaidCard }
            };

            const paymentMethods = await paymentMethodRepo.search(searchConditions);

            res.json(paymentMethods);
        } catch (error) {
            next(error);
        }
    }
);

export default prepaidCardPaymentMethodsRouter;
