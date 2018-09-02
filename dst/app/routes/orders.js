"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * 注文ルーター
 */
const cinerino = require("@cinerino/domain");
const express_1 = require("express");
const google_libphonenumber_1 = require("google-libphonenumber");
const moment = require("moment");
const authentication_1 = require("../middlewares/authentication");
const permitScopes_1 = require("../middlewares/permitScopes");
const validator_1 = require("../middlewares/validator");
const ordersRouter = express_1.Router();
ordersRouter.use(authentication_1.default);
/**
 * 確認番号と電話番号で注文照会
 */
ordersRouter.post('/findByOrderInquiryKey', permitScopes_1.default(['aws.cognito.signin.user.admin', 'orders', 'orders.read-only']), (req, _, next) => {
    req.checkBody('theaterCode', 'invalid theaterCode').notEmpty().withMessage('theaterCode is required');
    req.checkBody('confirmationNumber', 'invalid confirmationNumber').notEmpty().withMessage('confirmationNumber is required');
    req.checkBody('telephone', 'invalid telephone').notEmpty().withMessage('telephone is required');
    next();
}, validator_1.default, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const phoneUtil = google_libphonenumber_1.PhoneNumberUtil.getInstance();
        const phoneNumber = phoneUtil.parse(req.body.telephone, 'JP');
        if (!phoneUtil.isValidNumber(phoneNumber)) {
            next(new cinerino.factory.errors.Argument('telephone', 'Invalid phone number format'));
            return;
        }
        const key = {
            theaterCode: req.body.theaterCode,
            confirmationNumber: req.body.confirmationNumber,
            telephone: phoneUtil.format(phoneNumber, google_libphonenumber_1.PhoneNumberFormat.E164)
        };
        const repository = new cinerino.repository.Order(cinerino.mongoose.connection);
        const order = yield repository.findByOrderInquiryKey(key);
        res.json(order);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * 注文検索
 */
ordersRouter.get('', permitScopes_1.default(['admin']), (req, __2, next) => {
    req.checkQuery('orderDateFrom').notEmpty().withMessage('required').isISO8601().withMessage('must be ISO8601');
    req.checkQuery('orderDateThrough').notEmpty().withMessage('required').isISO8601().withMessage('must be ISO8601');
    next();
}, validator_1.default, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const orderRepo = new cinerino.repository.Order(cinerino.mongoose.connection);
        const searchConditions = {
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
        const orders = yield orderRepo.search(searchConditions);
        const totalCount = yield orderRepo.count(searchConditions);
        res.set('X-Total-Count', totalCount.toString());
        res.json(orders);
    }
    catch (error) {
        next(error);
    }
}));
exports.default = ordersRouter;
