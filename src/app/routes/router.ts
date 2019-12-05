/**
 * ルーター
 */
import * as express from 'express';

import healthRouter from './health';
import projectDetailRouter from './projects/detail';
import statsRouter from './stats';

import authentication from '../middlewares/authentication';

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

router.use('', projectDetailRouter);

router.use(
    '/projects/:id',
    (req, _, next) => {
        // プロジェクト指定ルーティング配下については、すべてreq.projectを上書き
        req.project = { typeOf: 'Project', id: req.params.id };

        next();
    },
    projectDetailRouter
);

export default router;
