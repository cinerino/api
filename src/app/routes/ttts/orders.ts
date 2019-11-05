/**
 * orders router
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';
// tslint:disable-next-line:no-submodule-imports
import { body } from 'express-validator/check';
import * as mongoose from 'mongoose';

import authentication from '../../middlewares/authentication';
import permitScopes from '../../middlewares/permitScopes';
import validator from '../../middlewares/validator';

// import * as redis from '../../../redis';

// import { tttsReservation2chevre } from '../../util/reservation';

/**
 * 正規表現をエスケープする
 */
function escapeRegExp(params: string) {
    return params.replace(/[.*+?^=!:${}()|[\]\/\\]/g, '\\$&');
}

const ordersRouter = Router();
ordersRouter.use(authentication);

/**
 * make inquiry of an order
 */
ordersRouter.post(
    '/findByOrderInquiryKey',
    permitScopes(['orders', 'orders.read-only']),
    // 互換性維持のため
    (req, _, next) => {
        if (typeof req.body.performanceDay === 'string' && typeof req.body.paymentNo === 'string') {
            req.body.confirmationNumber = `${req.body.performanceDay}${req.body.paymentNo}`;
        }

        if (typeof req.body.telephone === 'string') {
            req.body.customer = {
                telephone: req.body.telephone
            };
        }

        next();
    },
    ...[
        body('confirmationNumber')
            .not()
            .isEmpty()
            .withMessage((_, __) => 'required'),
        body('customer')
            .not()
            .isEmpty()
            .withMessage((_, __) => 'required')
    ],
    validator,
    async (req, res, next) => {
        try {
            // const key = {
            //     performanceDay: <string>req.body.performanceDay,
            //     paymentNo: <string>req.body.paymentNo,
            //     telephone: <string>req.body.telephone
            // };

            const orderRepo = new cinerino.repository.Order(mongoose.connection);
            let order: cinerino.factory.order.IOrder | undefined;

            const orders = await orderRepo.search({
                limit: 1,
                sort: { orderDate: cinerino.factory.sortType.Descending },
                customer: { telephone: `${escapeRegExp(req.body.customer.telephone)}$` },
                confirmationNumbers: [<string>req.body.confirmationNumber]
            });
            order = orders.shift();
            if (order === undefined) {
                // まだ注文が作成されていなければ、注文取引から検索するか検討中だが、いまのところ取引検索条件が足りない...
                throw new cinerino.factory.errors.NotFound('Order');
            }

            // order.acceptedOffers = order.acceptedOffers
            //     // 余分確保分を除く
            //     .filter((o) => {
            //         const reservation = <cinerino.factory.order.IReservation>o.itemOffered;
            //         let extraProperty: cinerino.factory.propertyValue.IPropertyValue<string> | undefined;
            //         if (reservation.additionalProperty !== undefined) {
            //             extraProperty = reservation.additionalProperty.find((p) => p.name === 'extra');
            //         }

            //         return reservation.additionalProperty === undefined
            //             || extraProperty === undefined
            //             || extraProperty.value !== '1';
            //     })
            //     // 互換性維持
            //     .map((o) => {
            //         return {
            //             ...o,
            //             itemOffered: tttsReservation2chevre(<cinerino.factory.order.IReservation>o.itemOffered)
            //         };
            //     });

            // 印刷トークンを発行
            // const tokenRepo = new cinerino.repository.Token(redis.getClient());
            // const reservationIds = order.acceptedOffers.map((o) => (<cinerino.factory.order.IReservation>o.itemOffered).id);
            // const printToken = await tokenRepo.createPrintToken(reservationIds);

            // res.json({
            //     ...order
            //     printToken: printToken
            // });
            res.json(order);
        } catch (error) {
            next(error);
        }
    }
);

export default ordersRouter;
