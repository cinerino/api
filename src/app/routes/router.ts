/**
 * ルーター
 */
import * as express from 'express';

import healthRouter from './health';
import projectsRouter from './projects';
import projectDetailRouter from './projects/detail';
import statsRouter from './stats';

import authentication from '../middlewares/authentication';
import setPermissions from '../middlewares/setPermissions';
import setProject from '../middlewares/setProject';

const router = express.Router();

// middleware that is specific to this router
// router.use((req, res, next) => {
//   debug('Time: ', Date.now())
//   next()
// })

// 例外的なpublic router
router.use('/health', healthRouter);
router.use('/stats', statsRouter);

// 認証
router.use(authentication);

// リクエストプロジェクト設定
router.use(setProject);

// プロジェクトメンバー権限を確認
router.use(setPermissions);

// プロジェクトルーター
router.use('/projects', projectsRouter);

// 以下、プロジェクト指定済の状態でルーティング
router.use('', projectDetailRouter);
router.use('/projects/:id', projectDetailRouter);

export default router;
