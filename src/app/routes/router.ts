/**
 * ルーター
 */
import * as cinerino from '@cinerino/domain';
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

// プロジェクト指定ルーティング配下については、すべてreq.projectを上書き
router.use(
    '/projects/:id',
    (req, _, next) => {
        // authenticationにてアプリケーションによってプロジェクト決定済であれば、比較
        // 本番マルチテナントサービスを設置するまで保留
        // if (req.project !== undefined && req.project !== null) {
        //     if (req.project.id !== req.params.id) {
        //         next(new cinerino.factory.errors.Forbidden(`client for ${req.project.id} forbidden`));

        //         return;
        //     }
        // }

        req.project = { typeOf: 'Project', id: req.params.id };

        next();
    }
);

router.use((req, _, next) => {
    // プロジェクト未指定は拒否
    if (req.project === undefined || req.project === null || typeof req.project.id !== 'string') {
        next(new cinerino.factory.errors.Forbidden('project not specified'));

        return;
    }

    next();
});

// 以下、プロジェクト指定済の状態でルーティング
router.use('', projectDetailRouter);
router.use('/projects/:id', projectDetailRouter);

export default router;
