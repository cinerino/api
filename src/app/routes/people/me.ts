/**
 * me(今ログイン中のユーザー)ルーター
 */
import { Router } from 'express';

import authentication from '../../middlewares/authentication';
import requireMember from '../../middlewares/requireMember';

import contactsRouter from './me/contacts';
import ordersRouter from './me/orders';
import ownershipInfosRouter from './me/ownershipInfos';

const meRouter = Router();

meRouter.use(authentication);
meRouter.use(requireMember); // 自分のリソースへのアクセスなので、もちろんログイン必須
meRouter.use('/contacts', contactsRouter);
meRouter.use('/orders', ordersRouter);
meRouter.use('/ownershipInfos', ownershipInfosRouter);

export default meRouter;
