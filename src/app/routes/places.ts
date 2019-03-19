/**
 * 場所ルーター
 */
import { Router } from 'express';
const placesRouter = Router();

import * as cinerino from '@cinerino/domain';
// import * as mongoose from 'mongoose';

import authentication from '../middlewares/authentication';
import permitScopes from '../middlewares/permitScopes';
import validator from '../middlewares/validator';

placesRouter.use(authentication);

placesRouter.get(
    '/movieTheater/:branchCode',
    permitScopes(['aws.cognito.signin.user.admin', 'places', 'places.read-only']),
    validator,
    async (req, res, next) => {
        try {
            const movieTheater = cinerino.service.masterSync.createMovieTheaterFromCOA(
                await cinerino.COA.services.master.theater({ theaterCode: req.params.branchCode }),
                await cinerino.COA.services.master.screen({ theaterCode: req.params.branchCode })
            );

            res.json(movieTheater);

            // const repository = new cinerino.repository.Place(mongoose.connection);
            // await repository.findMovieTheaterByBranchCode(req.params.branchCode)
            //     .then((theater) => {
            //         res.json(theater);
            //     });
        } catch (error) {
            next(error);
        }
    });

// おそらく使用していないので削除
// もし使用していれば戻す
// placesRouter.get(
//     '/movieTheater',
//     permitScopes(['aws.cognito.signin.user.admin', 'places', 'places.read-only']),
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
