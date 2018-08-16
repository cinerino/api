/**
 * me(今ログイン中のユーザー)ルーター
 */
import { Router } from 'express';

import authentication from '../../middlewares/authentication';
import requireMember from '../../middlewares/requireMember';

import accountsRouter from './me/accounts';
import contactsRouter from './me/contacts';
import creditCardsRouter from './me/creditCards';
import ownershipInfosRouter from './me/ownershipInfos';
import reservationsRouter from './me/reservations';

const meRouter = Router();

meRouter.use(authentication);
meRouter.use(requireMember); // 自分のリソースへのアクセスなので、もちろんログイン必須
meRouter.use('/accounts', accountsRouter);
meRouter.use('/contacts', contactsRouter);
meRouter.use('/creditCards', creditCardsRouter);
meRouter.use('/ownershipInfos', ownershipInfosRouter);
meRouter.use('/reservations', reservationsRouter);

export default meRouter;
