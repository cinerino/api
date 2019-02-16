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
 * 劇場組織ルーター
 */
const cinerino = require("@cinerino/domain");
const express_1 = require("express");
// tslint:disable-next-line:no-submodule-imports
const check_1 = require("express-validator/check");
const http_status_1 = require("http-status");
const mongoose = require("mongoose");
const authentication_1 = require("../../middlewares/authentication");
const permitScopes_1 = require("../../middlewares/permitScopes");
const validator_1 = require("../../middlewares/validator");
const movieTheaterRouter = express_1.Router();
movieTheaterRouter.use(authentication_1.default);
/**
 * 劇場組織追加
 */
movieTheaterRouter.post('', permitScopes_1.default(['admin', 'organizations']), ...[
    check_1.body('name.ja')
        .not()
        .isEmpty()
        .withMessage((_, options) => `${options.path} is required`),
    check_1.body('name.en')
        .not()
        .isEmpty()
        .withMessage((_, options) => `${options.path} is required`),
    check_1.body('parentOrganization.typeOf')
        .not()
        .isEmpty()
        .withMessage((_, options) => `${options.path} is required`),
    check_1.body('parentOrganization.name.ja')
        .not()
        .isEmpty()
        .withMessage((_, options) => `${options.path} is required`),
    check_1.body('parentOrganization.name.en')
        .not()
        .isEmpty()
        .withMessage((_, options) => `${options.path} is required`),
    check_1.body('location.typeOf')
        .not()
        .isEmpty()
        .withMessage((_, options) => `${options.path} is required`),
    check_1.body('location.branchCode')
        .not()
        .isEmpty()
        .withMessage((_, options) => `${options.path} is required`),
    check_1.body('location.name.ja')
        .not()
        .isEmpty()
        .withMessage((_, options) => `${options.path} is required`),
    check_1.body('location.name.en')
        .not()
        .isEmpty()
        .withMessage((_, options) => `${options.path} is required`),
    check_1.body('telephone')
        .not()
        .isEmpty()
        .withMessage((_, options) => `${options.path} is required`),
    check_1.body('url')
        .not()
        .isEmpty()
        .withMessage((_, options) => `${options.path} is required`)
        .isURL(),
    check_1.body('paymentAccepted')
        .not()
        .isEmpty()
        .withMessage((_, options) => `${options.path} is required`)
        .isArray(),
    check_1.body('hasPOS')
        .isArray(),
    check_1.body('areaServed')
        .isArray(),
    check_1.body('makesOffer')
        .isArray()
], validator_1.default, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const attributes = {
            typeOf: cinerino.factory.organizationType.MovieTheater,
            name: req.body.name,
            parentOrganization: req.body.parentOrganization,
            location: req.body.location,
            telephone: req.body.telephone,
            url: req.body.url,
            paymentAccepted: req.body.paymentAccepted,
            hasPOS: req.body.hasPOS,
            areaServed: req.body.areaServed,
            makesOffer: req.body.makesOffer
        };
        const organizationRepo = new cinerino.repository.Seller(mongoose.connection);
        const movieTheater = yield organizationRepo.save({ attributes: attributes });
        res.status(http_status_1.CREATED)
            .json(movieTheater);
    }
    catch (error) {
        next(error);
    }
}));
movieTheaterRouter.get('', permitScopes_1.default(['aws.cognito.signin.user.admin', 'organizations', 'organizations.read-only']), validator_1.default, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const sellerRepo = new cinerino.repository.Seller(mongoose.connection);
        const searchCoinditions = {
            // tslint:disable-next-line:no-magic-numbers
            limit: (req.query.limit !== undefined) ? Math.min(req.query.limit, 100) : 100,
            page: (req.query.page !== undefined) ? Math.max(req.query.page, 1) : 1,
            sort: req.query.sort,
            name: req.query.name
        };
        const movieTheaters = yield sellerRepo.search(searchCoinditions);
        const totalCount = yield sellerRepo.count(searchCoinditions);
        res.set('X-Total-Count', totalCount.toString());
        res.json(movieTheaters);
    }
    catch (error) {
        next(error);
    }
}));
movieTheaterRouter.get('/:id', permitScopes_1.default(['aws.cognito.signin.user.admin', 'organizations', 'organizations.read-only']), validator_1.default, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const sellerRepo = new cinerino.repository.Seller(mongoose.connection);
        const movieTheater = yield sellerRepo.findById({
            id: req.params.id
        });
        res.json(movieTheater);
    }
    catch (error) {
        next(error);
    }
}));
movieTheaterRouter.put('/:id', permitScopes_1.default(['admin', 'organizations']), ...[
    check_1.body('name.ja')
        .not()
        .isEmpty()
        .withMessage((_, options) => `${options.path} is required`),
    check_1.body('name.en')
        .not()
        .isEmpty()
        .withMessage((_, options) => `${options.path} is required`),
    check_1.body('parentOrganization.typeOf')
        .not()
        .isEmpty()
        .withMessage((_, options) => `${options.path} is required`),
    check_1.body('parentOrganization.name.ja')
        .not()
        .isEmpty()
        .withMessage((_, options) => `${options.path} is required`),
    check_1.body('parentOrganization.name.en')
        .not()
        .isEmpty()
        .withMessage((_, options) => `${options.path} is required`),
    check_1.body('location.typeOf')
        .not()
        .isEmpty()
        .withMessage((_, options) => `${options.path} is required`),
    check_1.body('location.branchCode')
        .not()
        .isEmpty()
        .withMessage((_, options) => `${options.path} is required`),
    check_1.body('location.name.ja')
        .not()
        .isEmpty()
        .withMessage((_, options) => `${options.path} is required`),
    check_1.body('location.name.en')
        .not()
        .isEmpty()
        .withMessage((_, options) => `${options.path} is required`),
    check_1.body('telephone')
        .not()
        .isEmpty()
        .withMessage((_, options) => `${options.path} is required`),
    check_1.body('url')
        .not()
        .isEmpty()
        .withMessage((_, options) => `${options.path} is required`)
        .isURL(),
    check_1.body('paymentAccepted')
        .not()
        .isEmpty()
        .withMessage((_, options) => `${options.path} is required`)
        .isArray(),
    check_1.body('hasPOS')
        .isArray(),
    check_1.body('areaServed')
        .isArray(),
    check_1.body('makesOffer')
        .isArray()
], validator_1.default, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const attributes = {
            typeOf: cinerino.factory.organizationType.MovieTheater,
            name: req.body.name,
            parentOrganization: req.body.parentOrganization,
            location: req.body.location,
            telephone: req.body.telephone,
            url: req.body.url,
            paymentAccepted: req.body.paymentAccepted,
            hasPOS: req.body.hasPOS,
            areaServed: req.body.areaServed,
            makesOffer: req.body.makesOffer
        };
        const organizationRepo = new cinerino.repository.Seller(mongoose.connection);
        yield organizationRepo.save({ id: req.params.id, attributes: attributes });
        res.status(http_status_1.NO_CONTENT)
            .end();
    }
    catch (error) {
        next(error);
    }
}));
movieTheaterRouter.delete('/:id', permitScopes_1.default(['admin', 'organizations']), validator_1.default, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const sellerRepo = new cinerino.repository.Seller(mongoose.connection);
        yield sellerRepo.deleteById({
            id: req.params.id
        });
        res.status(http_status_1.NO_CONTENT)
            .end();
    }
    catch (error) {
        next(error);
    }
}));
exports.default = movieTheaterRouter;
