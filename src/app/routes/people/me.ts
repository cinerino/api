/**
 * me(今ログイン中のユーザー)ルーター
 */
import { Router } from 'express';

import authentication from '../../middlewares/authentication';
import requireMember from '../../middlewares/requireMember';

import ordersRouter from './me/orders';
import ownershipInfosRouter from './me/ownershipInfos';
import profileRouter from './me/profile';
import me4cinemasunshineRouter from './me4cinemasunshine';

const meRouter = Router();

meRouter.use(authentication);
meRouter.use(requireMember); // 自分のリソースへのアクセスなので、ログイン必須

// Cinemasunshine対応
meRouter.use(me4cinemasunshineRouter); // 自分のリソースへのアクセスなので、ログイン必須

meRouter.use('/orders', ordersRouter);
meRouter.use('/ownershipInfos', ownershipInfosRouter);
meRouter.use('/profile', profileRouter);

export default meRouter;
