/**
 * 劇場組織ルーター
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';
// tslint:disable-next-line:no-submodule-imports
import { body } from 'express-validator/check';
import { CREATED, NO_CONTENT } from 'http-status';

import authentication from '../../middlewares/authentication';
import permitScopes from '../../middlewares/permitScopes';
import validator from '../../middlewares/validator';

const movieTheaterRouter = Router();
movieTheaterRouter.use(authentication);

/**
 * 劇場組織追加
 */
movieTheaterRouter.post(
    '',
    permitScopes(['admin', 'organizations']),
    ...[
        body('name.ja')
            .not()
            .isEmpty()
            .withMessage((_, options) => `${options.path} is required`),
        body('name.en')
            .not()
            .isEmpty()
            .withMessage((_, options) => `${options.path} is required`),
        body('parentOrganization.typeOf')
            .not()
            .isEmpty()
            .withMessage((_, options) => `${options.path} is required`),
        body('parentOrganization.name.ja')
            .not()
            .isEmpty()
            .withMessage((_, options) => `${options.path} is required`),
        body('parentOrganization.name.en')
            .not()
            .isEmpty()
            .withMessage((_, options) => `${options.path} is required`),
        body('location.typeOf')
            .not()
            .isEmpty()
            .withMessage((_, options) => `${options.path} is required`),
        body('location.branchCode')
            .not()
            .isEmpty()
            .withMessage((_, options) => `${options.path} is required`),
        body('location.name.ja')
            .not()
            .isEmpty()
            .withMessage((_, options) => `${options.path} is required`),
        body('location.name.en')
            .not()
            .isEmpty()
            .withMessage((_, options) => `${options.path} is required`),
        body('telephone')
            .not()
            .isEmpty()
            .withMessage((_, options) => `${options.path} is required`),
        body('url')
            .not()
            .isEmpty()
            .withMessage((_, options) => `${options.path} is required`)
            .isURL(),
        body('paymentAccepted')
            .not()
            .isEmpty()
            .withMessage((_, options) => `${options.path} is required`)
            .isArray(),
        body('hasPOS')
            .isArray(),
        body('areaServed')
            .isArray(),
        body('makesOffer')
            .isArray()
    ],
    validator,
    async (req, res, next) => {
        try {
            const attributes: cinerino.factory.seller.IAttributes<cinerino.factory.organizationType.MovieTheater> = {
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
            const organizationRepo = new cinerino.repository.Seller(cinerino.mongoose.connection);
            const movieTheater = await organizationRepo.save({ attributes: attributes });
            res.status(CREATED)
                .json(movieTheater);
        } catch (error) {
            next(error);
        }
    }
);

movieTheaterRouter.get(
    '',
    permitScopes(['aws.cognito.signin.user.admin', 'organizations', 'organizations.read-only']),
    validator,
    async (req, res, next) => {
        try {
            const sellerRepo = new cinerino.repository.Seller(cinerino.mongoose.connection);
            const searchCoinditions: cinerino.factory.seller.ISearchConditions = {
                // tslint:disable-next-line:no-magic-numbers
                limit: (req.query.limit !== undefined) ? Math.min(req.query.limit, 100) : 100,
                page: (req.query.page !== undefined) ? Math.max(req.query.page, 1) : 1,
                sort: req.query.sort,
                name: req.query.name
            };
            const movieTheaters = await sellerRepo.search(searchCoinditions);
            const totalCount = await sellerRepo.count(searchCoinditions);
            res.set('X-Total-Count', totalCount.toString());
            res.json(movieTheaters);
        } catch (error) {
            next(error);
        }
    }
);

movieTheaterRouter.get(
    '/:id',
    permitScopes(['aws.cognito.signin.user.admin', 'organizations', 'organizations.read-only']),
    validator,
    async (req, res, next) => {
        try {
            const sellerRepo = new cinerino.repository.Seller(cinerino.mongoose.connection);
            const movieTheater = await sellerRepo.findById({
                id: req.params.id
            });
            res.json(movieTheater);
        } catch (error) {
            next(error);
        }
    }
);

movieTheaterRouter.put(
    '/:id',
    permitScopes(['admin', 'organizations']),
    ...[
        body('name.ja')
            .not()
            .isEmpty()
            .withMessage((_, options) => `${options.path} is required`),
        body('name.en')
            .not()
            .isEmpty()
            .withMessage((_, options) => `${options.path} is required`),
        body('parentOrganization.typeOf')
            .not()
            .isEmpty()
            .withMessage((_, options) => `${options.path} is required`),
        body('parentOrganization.name.ja')
            .not()
            .isEmpty()
            .withMessage((_, options) => `${options.path} is required`),
        body('parentOrganization.name.en')
            .not()
            .isEmpty()
            .withMessage((_, options) => `${options.path} is required`),
        body('location.typeOf')
            .not()
            .isEmpty()
            .withMessage((_, options) => `${options.path} is required`),
        body('location.branchCode')
            .not()
            .isEmpty()
            .withMessage((_, options) => `${options.path} is required`),
        body('location.name.ja')
            .not()
            .isEmpty()
            .withMessage((_, options) => `${options.path} is required`),
        body('location.name.en')
            .not()
            .isEmpty()
            .withMessage((_, options) => `${options.path} is required`),
        body('telephone')
            .not()
            .isEmpty()
            .withMessage((_, options) => `${options.path} is required`),
        body('url')
            .not()
            .isEmpty()
            .withMessage((_, options) => `${options.path} is required`)
            .isURL(),
        body('paymentAccepted')
            .not()
            .isEmpty()
            .withMessage((_, options) => `${options.path} is required`)
            .isArray(),
        body('hasPOS')
            .isArray(),
        body('areaServed')
            .isArray(),
        body('makesOffer')
            .isArray()
    ],
    validator,
    async (req, res, next) => {
        try {
            const attributes: cinerino.factory.seller.IAttributes<cinerino.factory.organizationType.MovieTheater> = {
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
            const organizationRepo = new cinerino.repository.Seller(cinerino.mongoose.connection);
            await organizationRepo.save({ id: req.params.id, attributes: attributes });
            res.status(NO_CONTENT)
                .end();
        } catch (error) {
            next(error);
        }
    }
);

movieTheaterRouter.delete(
    '/:id',
    permitScopes(['admin', 'organizations']),
    validator,
    async (req, res, next) => {
        try {
            const sellerRepo = new cinerino.repository.Seller(cinerino.mongoose.connection);
            await sellerRepo.deleteById({
                id: req.params.id
            });
            res.status(NO_CONTENT)
                .end();
        } catch (error) {
            next(error);
        }
    }
);

export default movieTheaterRouter;
