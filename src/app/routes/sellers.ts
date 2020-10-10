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

            const { data } = await sellerService.search({
                ...req.query,
                project: { id: { $eq: req.project.id } },
                // 管理者以外にセキュアな情報を露出しないように
                ...(!req.isAdmin)
                    ? {
                        $projection: {
                            'paymentAccepted.gmoInfo.shopPass': 0,
                            'paymentAccepted.movieTicketInfo': 0
                        }
                    }
                    : undefined
            });

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
                ...(!req.isAdmin)
                    ? {
                        $projection: {
                            'paymentAccepted.gmoInfo.shopPass': 0,
                            'paymentAccepted.movieTicketInfo': 0
                        }
                    }
                    : undefined
            });

            res.json(seller);
        } catch (error) {
            next(error);
        }
    }
);

export default sellersRouter;
