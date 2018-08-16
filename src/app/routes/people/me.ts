/**
 * me(今ログイン中のユーザー)ルーター
 */
import { Router } from 'express';

import authentication from '../../middlewares/authentication';
import requireMember from '../../middlewares/requireMember';

import pointAccountsRouter from './me/accounts/point';
import contactsRouter from './me/contacts';
import creditCardsRouter from './me/creditCards';
import ownershipInfosRouter from './me/ownershipInfos';

const meRouter = Router();

meRouter.use(authentication);
meRouter.use(requireMember); // 自分のリソースへのアクセスなので、もちろんログイン必須
meRouter.use('/accounts/point', pointAccountsRouter);
meRouter.use('/contacts', contactsRouter);
meRouter.use('/creditCards', creditCardsRouter);
meRouter.use('/ownershipInfos', ownershipInfosRouter);

export default meRouter;
