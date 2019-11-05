"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * orders router
 */
const cinerino = require("@cinerino/domain");
const express_1 = require("express");
// tslint:disable-next-line:no-submodule-imports
const check_1 = require("express-validator/check");
const mongoose = require("mongoose");
const authentication_1 = require("../../middlewares/authentication");
const permitScopes_1 = require("../../middlewares/permitScopes");
const validator_1 = require("../../middlewares/validator");
const redis = require("../../../redis");
// import { tttsReservation2chevre } from '../../util/reservation';
/**
 * 正規表現をエスケープする
 */
function escapeRegExp(params) {
    return params.replace(/[.*+?^=!:${}()|[\]\/\\]/g, '\\$&');
}
const ordersRouter = express_1.Router();
ordersRouter.use(authentication_1.default);
/**
 * make inquiry of an order
 */
ordersRouter.post('/findByOrderInquiryKey', permitScopes_1.default(['orders', 'orders.read-only']), 
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
}, ...[
    check_1.body('confirmationNumber')
        .not()
        .isEmpty()
        .withMessage((_, __) => 'required'),
    check_1.body('customer')
        .not()
        .isEmpty()
        .withMessage((_, __) => 'required')
], validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // const key = {
        //     performanceDay: <string>req.body.performanceDay,
        //     paymentNo: <string>req.body.paymentNo,
        //     telephone: <string>req.body.telephone
        // };
        const orderRepo = new cinerino.repository.Order(mongoose.connection);
        let order;
        const orders = yield orderRepo.search({
            limit: 1,
            sort: { orderDate: cinerino.factory.sortType.Descending },
            customer: { telephone: `${escapeRegExp(req.body.customer.telephone)}$` },
            confirmationNumbers: [req.body.confirmationNumber]
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
        const tokenRepo = new cinerino.repository.Token(redis.getClient());
        const reservationIds = order.acceptedOffers.map((o) => o.itemOffered.id);
        const printToken = yield tokenRepo.createPrintToken(reservationIds);
        res.json(Object.assign(Object.assign({}, order), { printToken: printToken }));
    }
    catch (error) {
        next(error);
    }
}));
exports.default = ordersRouter;
