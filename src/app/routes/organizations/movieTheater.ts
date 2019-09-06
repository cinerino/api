/**
 * 劇場組織ルーター
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';
import * as mongoose from 'mongoose';

import authentication from '../../middlewares/authentication';
import permitScopes from '../../middlewares/permitScopes';
import validator from '../../middlewares/validator';

type ICreditCardPaymentAccepted = cinerino.factory.seller.IPaymentAccepted<cinerino.factory.paymentMethodType.CreditCard>;

const movieTheaterRouter = Router();
movieTheaterRouter.use(authentication);

/**
 * @deprecated Use /sellers
 */
movieTheaterRouter.get(
    '',
    permitScopes(['customer', 'organizations', 'organizations.read-only']),
    validator,
    async (req, res, next) => {
        try {
            const searchCoinditions: cinerino.factory.seller.ISearchConditions = {
                ...req.query,
                // tslint:disable-next-line:no-magic-numbers
                limit: (req.query.limit !== undefined) ? Math.min(req.query.limit, 100) : 100,
                page: (req.query.page !== undefined) ? Math.max(req.query.page, 1) : 1
            };

            const sellerRepo = new cinerino.repository.Seller(mongoose.connection);
            const movieTheaters = await sellerRepo.search(
                searchCoinditions,
                // 管理者以外にセキュアな情報を露出しないように
                (!req.isAdmin) ? { 'paymentAccepted.gmoInfo.shopPass': 0 } : undefined
            );
            const totalCount = await sellerRepo.count(searchCoinditions);

            movieTheaters.forEach((movieTheater) => {
                // 互換性維持のためgmoInfoをpaymentAcceptedから情報追加
                if (Array.isArray(movieTheater.paymentAccepted)) {
                    const creditCardPaymentAccepted = <ICreditCardPaymentAccepted>movieTheater.paymentAccepted.find((p) => {
                        return p.paymentMethodType === cinerino.factory.paymentMethodType.CreditCard;
                    });
                    if (creditCardPaymentAccepted !== undefined) {
                        (<any>movieTheater).gmoInfo = creditCardPaymentAccepted.gmoInfo;
                    }
                }
            });

            res.set('X-Total-Count', totalCount.toString());
            res.json(movieTheaters);
        } catch (error) {
            next(error);
        }
    }
);

/**
 * @deprecated Use /sellers
 */
movieTheaterRouter.get(
    '/:branchCode([0-9]{3})',
    permitScopes(['customer', 'organizations', 'organizations.read-only']),
    validator,
    async (req, res, next) => {
        try {
            const sellerRepo = new cinerino.repository.Seller(mongoose.connection);
            const movieTheaters = await sellerRepo.search(
                {
                    location: { branchCodes: [req.params.branchCode] }
                },
                // 管理者以外にセキュアな情報を露出しないように
                (!req.isAdmin) ? { 'paymentAccepted.gmoInfo.shopPass': 0 } : undefined
            );
            const movieTheater = movieTheaters.shift();
            if (movieTheater === undefined) {
                throw new cinerino.factory.errors.NotFound('Organization');
            }

            // 互換性維持のためgmoInfoをpaymentAcceptedから情報追加
            if (Array.isArray(movieTheater.paymentAccepted)) {
                const creditCardPaymentAccepted = <ICreditCardPaymentAccepted>movieTheater.paymentAccepted.find((p) => {
                    return p.paymentMethodType === cinerino.factory.paymentMethodType.CreditCard;
                });
                if (creditCardPaymentAccepted !== undefined) {
                    (<any>movieTheater).gmoInfo = creditCardPaymentAccepted.gmoInfo;
                }
            }

            res.json(movieTheater);
        } catch (error) {
            next(error);
        }
    }
);

/**
 * @deprecated Use /sellers
 */
movieTheaterRouter.get(
    '/:id',
    permitScopes(['customer', 'organizations', 'organizations.read-only']),
    validator,
    async (req, res, next) => {
        try {
            const sellerRepo = new cinerino.repository.Seller(mongoose.connection);
            const movieTheater = await sellerRepo.findById(
                {
                    id: req.params.id
                },
                // 管理者以外にセキュアな情報を露出しないように
                (!req.isAdmin) ? { 'paymentAccepted.gmoInfo.shopPass': 0 } : undefined
            );
            res.json(movieTheater);
        } catch (error) {
            next(error);
        }
    }
);

export default movieTheaterRouter;
