/**
 * 注文ルーター
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';
import { PhoneNumberFormat, PhoneNumberUtil } from 'google-libphonenumber';
import * as moment from 'moment';

import authentication from '../middlewares/authentication';
import permitScopes from '../middlewares/permitScopes';
import validator from '../middlewares/validator';

const ordersRouter = Router();
ordersRouter.use(authentication);
/**
 * IDとPASSで注文照会
 */
ordersRouter.post(
    '/findByOrderInquiryKey',
    permitScopes(['aws.cognito.signin.user.admin', 'orders', 'orders.read-only']),
    (_1, _2, next) => {
        // req.checkBody('theaterCode', 'invalid theaterCode').notEmpty().withMessage('theaterCode is required');
        // req.checkBody('confirmationNumber', 'invalid confirmationNumber').notEmpty().withMessage('confirmationNumber is required');
        // req.checkBody('telephone', 'invalid telephone').notEmpty().withMessage('telephone is required');
        next();
    },
    validator,
    async (req, res, next) => {
        try {
            const phoneUtil = PhoneNumberUtil.getInstance();
            const phoneNumber = phoneUtil.parse(req.body.telephone, 'JP');
            if (!phoneUtil.isValidNumber(phoneNumber)) {
                next(new cinerino.factory.errors.Argument('telephone', 'Invalid phone number format'));

                return;
            }
            const key = {
                theaterCode: req.body.theaterCode,
                confirmationNumber: req.body.confirmationNumber,
                telephone: phoneUtil.format(phoneNumber, PhoneNumberFormat.E164)
            };
            const repository = new cinerino.repository.Order(cinerino.mongoose.connection);
            const order = await repository.findByOrderInquiryKey(key);
            res.json(order);
        } catch (error) {
            next(error);
        }
    }
);
/**
 * 注文検索
 */
ordersRouter.get(
    '',
    permitScopes(['admin']),
    (req, __2, next) => {
        req.checkQuery('orderDateFrom').notEmpty().withMessage('required').isISO8601().withMessage('must be ISO8601');
        req.checkQuery('orderDateThrough').notEmpty().withMessage('required').isISO8601().withMessage('must be ISO8601');
        next();
    },
    validator,
    async (req, res, next) => {
        try {
            const orderRepo = new cinerino.repository.Order(cinerino.mongoose.connection);
            const searchConditions: cinerino.factory.order.ISearchConditions = {
                // tslint:disable-next-line:no-magic-numbers
                limit: (req.query.limit !== undefined) ? Math.min(req.query.limit, 100) : 100,
                page: (req.query.page !== undefined) ? Math.max(req.query.page, 1) : 1,
                sort: (req.query.sort !== undefined) ? req.query.sort : { orderDate: cinerino.factory.sortType.Descending },
                sellerIds: (Array.isArray(req.query.sellerIds)) ? req.query.sellerIds : undefined,
                customerMembershipNumbers: (Array.isArray(req.query.customerMembershipNumbers))
                    ? req.query.customerMembershipNumbers
                    : undefined,
                orderNumbers: (Array.isArray(req.query.orderNumbers)) ? req.query.orderNumbers : undefined,
                orderStatuses: (Array.isArray(req.query.orderStatuses)) ? req.query.orderStatuses : undefined,
                orderDateFrom: moment(req.query.orderDateFrom).toDate(),
                orderDateThrough: moment(req.query.orderDateThrough).toDate(),
                confirmationNumbers: (Array.isArray(req.query.confirmationNumbers))
                    ? req.query.confirmationNumbers
                    : undefined,
                reservedEventIds: (Array.isArray(req.query.reservedEventIds))
                    ? req.query.reservedEventIds
                    : undefined
            };
            const orders = await orderRepo.search(searchConditions);
            const totalCount = await orderRepo.count(searchConditions);
            res.set('X-Total-Count', totalCount.toString());
            res.json(orders);
        } catch (error) {
            next(error);
        }
    }
);
export default ordersRouter;
