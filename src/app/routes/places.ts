/**
 * 場所ルーター
 * @deprecated フロントエンドが使用を停止し次第、廃止
 */
import { Router } from 'express';
const placesRouter = Router();

import * as cinerino from '@cinerino/domain';
import { PhoneNumberFormat, PhoneNumberUtil } from 'google-libphonenumber';
import * as mongoose from 'mongoose';

import authentication from '../middlewares/authentication';
import permitScopes from '../middlewares/permitScopes';
import validator from '../middlewares/validator';

placesRouter.use(authentication);

placesRouter.get(
    '/movieTheater/:branchCode',
    permitScopes(['customer', 'places', 'places.read-only']),
    validator,
    async (req, res, next) => {
        try {
            // const movieTheater = cinerino.service.masterSync.createMovieTheaterFromCOA(
            //     await cinerino.COA.services.master.theater({ theaterCode: req.params.branchCode }),
            //     await cinerino.COA.services.master.screen({ theaterCode: req.params.branchCode })
            // );

            const sellerRepo = new cinerino.repository.Seller(mongoose.connection);
            const sellers = await sellerRepo.search({
                limit: 1,
                location: { branchCodes: [<string>req.params.branchCode] }
            });
            const seller = sellers.shift();
            if (seller === undefined) {
                throw new cinerino.factory.errors.NotFound('Seller');
            }
            if (seller.location === undefined) {
                throw new cinerino.factory.errors.NotFound('Seller Location');
            }

            const phoneUtil = PhoneNumberUtil.getInstance();
            const phoneNumber = phoneUtil.parse(seller.telephone);

            const movieTheater: any = {
                ...seller.location,
                telephone: phoneUtil.format(phoneNumber, PhoneNumberFormat.NATIONAL)
            };

            res.json(movieTheater);
        } catch (error) {
            next(error);
        }
    });

// おそらく使用していないので削除
// もし使用していれば戻す
// placesRouter.get(
//     '/movieTheater',
//     permitScopes(['customer', 'places', 'places.read-only']),
//     validator,
//     async (__, res, next) => {
//         try {
//             const repository = new cinerino.repository.Place(mongoose.connection);
//             await repository.searchMovieTheaters({})
//                 .then((places) => {
//                     res.json(places);
//                 });
//         } catch (error) {
//             next(error);
//         }
//     }
// );

export default placesRouter;
