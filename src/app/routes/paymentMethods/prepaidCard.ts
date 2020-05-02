/**
 * プリペイドカードルーター
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';
import { body } from 'express-validator';
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
                accountType: cinerino.factory.paymentMethodType.PrepaidCard,
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
                serviceOutput: req.body.serviceOutput,
                ...{
                    name: account.name
                }
            };

            const doc = await paymentMethodRepo.paymentMethodModel.create(prepaidCard);

            res.json(doc.toObject());
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
    validator,
    async (req, res, next) => {
        try {
            const paymentMethodRepo = new cinerino.repository.PaymentMethod(mongoose.connection);
            // const searchCoinditions = {
            //     ...req.query,
            //     project: { ids: [req.project.id] },
            //     // tslint:disable-next-line:no-magic-numbers
            //     limit: (req.query.limit !== undefined) ? Math.min(req.query.limit, 100) : 100,
            //     page: (req.query.page !== undefined) ? Math.max(req.query.page, 1) : 1
            // };
            const docs = await paymentMethodRepo.paymentMethodModel.find(
                {
                    'project.id': { $exists: true, $eq: req.project.id },
                    typeOf: { $eq: cinerino.factory.paymentMethodType.PrepaidCard }
                },
                {
                    __v: 0,
                    createdAt: 0,
                    updatedAt: 0
                }
            )
                .limit(req.query.limit)
                .skip(req.query.limit * (req.query.page - 1))
                .setOptions({ maxTimeMS: 10000 })
                .exec();

            res.json(docs.map((doc) => doc.toObject()));
        } catch (error) {
            next(error);
        }
    }
);

export default prepaidCardPaymentMethodsRouter;
