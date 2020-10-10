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

const USE_LEGACY_SELLERS_SEARCH = process.env.USE_LEGACY_SELLERS_SEARCH === '1';

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

            if (!USE_LEGACY_SELLERS_SEARCH) {
                // location.branchCodesをadditionalPropertyに自動変換
                const locationBranchCodes = req.query.location?.branchCodes;
                if (Array.isArray(locationBranchCodes)) {
                    req.query.additionalProperty = {
                        ...req.query.additionalProperty,
                        $in: locationBranchCodes.map((branchCode: any) => {
                            return { name: 'branchCode', value: String(branchCode) };
                        })
                    };

                    req.query.location.branchCodes = undefined;
                }
            }

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

            res.json(data.map(addLocation));
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

            res.json(addLocation(seller));
        } catch (error) {
            next(error);
        }
    }
);

/**
 * ssktsへの互換性維持対応として、location属性を自動保管
 */
function addLocation(params: cinerino.factory.chevre.seller.ISeller): cinerino.factory.chevre.seller.ISeller {
    const seller: cinerino.factory.chevre.seller.ISeller = { ...params };

    const branchCode = params.additionalProperty?.find((p) => p.name === 'branchCode')?.value;
    if (typeof branchCode === 'string') {
        seller.location = { project: seller.project, typeOf: cinerino.factory.chevre.placeType.MovieTheater, branchCode };
    }

    return seller;
}

export default sellersRouter;
