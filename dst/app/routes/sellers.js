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
 * 販売者ルーター
 */
const cinerino = require("@cinerino/domain");
const express_1 = require("express");
const permitScopes_1 = require("../middlewares/permitScopes");
const rateLimit_1 = require("../middlewares/rateLimit");
const validator_1 = require("../middlewares/validator");
const chevreAuthClient = new cinerino.chevre.auth.ClientCredentials({
    domain: process.env.CHEVRE_AUTHORIZE_SERVER_DOMAIN,
    clientId: process.env.CHEVRE_CLIENT_ID,
    clientSecret: process.env.CHEVRE_CLIENT_SECRET,
    scopes: [],
    state: ''
});
const sellersRouter = express_1.Router();
/**
 * 販売者検索
 */
sellersRouter.get('', permitScopes_1.default(['sellers.*', 'sellers.read', 'pos']), rateLimit_1.default, validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const sellerService = new cinerino.chevre.service.Seller({
            endpoint: cinerino.credentials.chevre.endpoint,
            auth: chevreAuthClient
        });
        const { data, totalCount } = yield sellerService.search(Object.assign(Object.assign(Object.assign({}, req.query), { project: { id: { $eq: req.project.id } } }), (!req.isAdmin) ? { $projection: { 'paymentAccepted.gmoInfo.shopPass': 0 } } : undefined));
        if (typeof totalCount === 'number') {
            res.set('X-Total-Count', totalCount.toString());
        }
        res.json(data);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * IDで販売者検索
 */
sellersRouter.get('/:id', permitScopes_1.default(['sellers.*', 'sellers.read']), rateLimit_1.default, validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const sellerService = new cinerino.chevre.service.Seller({
            endpoint: cinerino.credentials.chevre.endpoint,
            auth: chevreAuthClient
        });
        const seller = yield sellerService.findById(Object.assign({ id: req.params.id }, (!req.isAdmin) ? { $projection: { 'paymentAccepted.gmoInfo.shopPass': 0 } } : undefined));
        res.json(seller);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * 販売者更新
 */
// tslint:disable-next-line:use-default-type-parameter
// sellersRouter.put<ParamsDictionary>(
//     '/:id',
//     permitScopes(['sellers.*', 'sellers.write']),
//     rateLimit,
//     ...[
//         body('typeOf')
//             .not()
//             .isEmpty()
//             .withMessage((_, __) => 'required'),
//         body('name.ja')
//             .not()
//             .isEmpty()
//             .withMessage((_, __) => 'required'),
//         body('name.en')
//             .not()
//             .isEmpty()
//             .withMessage((_, __) => 'required'),
//         body('parentOrganization.typeOf')
//             .not()
//             .isEmpty()
//             .withMessage((_, __) => 'required'),
//         body('parentOrganization.name.ja')
//             .not()
//             .isEmpty()
//             .withMessage((_, __) => 'required'),
//         body('parentOrganization.name.en')
//             .not()
//             .isEmpty()
//             .withMessage((_, __) => 'required'),
//         body('telephone')
//             .not()
//             .isEmpty()
//             .withMessage((_, __) => 'required'),
//         body('url')
//             .not()
//             .isEmpty()
//             .withMessage((_, __) => 'required')
//             .isURL(),
//         body('paymentAccepted')
//             .not()
//             .isEmpty()
//             .withMessage((_, __) => 'required')
//             .isArray(),
//         body('hasPOS')
//             .isArray(),
//         body('areaServed')
//             .isArray()
//     ],
//     validator,
//     async (req, res, next) => {
//         try {
//             const attributes: cinerino.factory.seller.IAttributes<typeof req.body.typeOf> = {
//                 ...req.body,
//                 project: req.project
//             };
//             const sellerRepo = new cinerino.repository.Seller(mongoose.connection);
//             await sellerRepo.save({ id: req.params.id, attributes: attributes });
//             res.status(NO_CONTENT)
//                 .end();
//         } catch (error) {
//             next(error);
//         }
//     }
// );
/**
 * 販売者削除
 */
// sellersRouter.delete(
//     '/:id',
//     permitScopes(['sellers.*', 'sellers.write']),
//     rateLimit,
//     validator,
//     async (req, res, next) => {
//         try {
//             const sellerRepo = new cinerino.repository.Seller(mongoose.connection);
//             await sellerRepo.deleteById({
//                 id: req.params.id
//             });
//             res.status(NO_CONTENT)
//                 .end();
//         } catch (error) {
//             next(error);
//         }
//     }
// );
exports.default = sellersRouter;
