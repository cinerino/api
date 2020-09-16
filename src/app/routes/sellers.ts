/**
 * 販売者ルーター
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';

import permitScopes from '../middlewares/permitScopes';
import rateLimit from '../middlewares/rateLimit';
import validator from '../middlewares/validator';

const chevreAuthClient = new cinerino.chevre.auth.ClientCredentials({
    domain: <string>process.env.CHEVRE_AUTHORIZE_SERVER_DOMAIN,
    clientId: <string>process.env.CHEVRE_CLIENT_ID,
    clientSecret: <string>process.env.CHEVRE_CLIENT_SECRET,
    scopes: [],
    state: ''
});

const sellersRouter = Router();

/**
 * 販売者検索
 */
sellersRouter.get(
    '',
    permitScopes(['sellers.*', 'sellers.read', 'pos']),
    rateLimit,
    validator,
    async (req, res, next) => {
        try {
            const sellerService = new cinerino.chevre.service.Seller({
                endpoint: cinerino.credentials.chevre.endpoint,
                auth: chevreAuthClient
            });

            const { data, totalCount } = await sellerService.search({
                ...req.query,
                project: { id: { $eq: req.project.id } },
                // 管理者以外にセキュアな情報を露出しないように
                ...(!req.isAdmin) ? { $projection: { 'paymentAccepted.gmoInfo.shopPass': 0 } } : undefined
            });

            if (typeof totalCount === 'number') {
                // res.set('X-Total-Count', totalCount.toString());
            }
            res.json(data);
        } catch (error) {
            next(error);
        }
    }
);

/**
 * IDで販売者検索
 */
sellersRouter.get(
    '/:id',
    permitScopes(['sellers.*', 'sellers.read']),
    rateLimit,
    validator,
    async (req, res, next) => {
        try {
            const sellerService = new cinerino.chevre.service.Seller({
                endpoint: cinerino.credentials.chevre.endpoint,
                auth: chevreAuthClient
            });

            const seller = await sellerService.findById({
                id: req.params.id,
                // 管理者以外にセキュアな情報を露出しないように
                ...(!req.isAdmin) ? { $projection: { 'paymentAccepted.gmoInfo.shopPass': 0 } } : undefined
            });

            res.json(seller);
        } catch (error) {
            next(error);
        }
    }
);

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

export default sellersRouter;
