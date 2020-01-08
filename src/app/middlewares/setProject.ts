/**
 * リクエストプロジェクト設定ルーター
 */
import * as cinerino from '@cinerino/domain';
import * as express from 'express';

const setProjectRouter = express.Router();

setProjectRouter.use((req, _, next) => {
    let project: cinerino.factory.project.IProject | undefined;

    // アプリケーションからプロジェクトをセット
    if (req.application !== undefined && req.application !== null) {
        if (req.application.project !== undefined && req.application.project !== null) {
            project = { typeOf: req.application.project.typeOf, id: req.application.project.id };
        }
    }

    // 環境変数設定が存在する場合
    if (typeof process.env.PROJECT_ID === 'string') {
        if (project === undefined) {
            // 環境変数
            project = { typeOf: cinerino.factory.organizationType.Project, id: process.env.PROJECT_ID };
        } else {
            // アプリケーション設定と環境変数設定両方が存在する場合、プロジェクトが異なればforbidden
            if (project.id !== process.env.PROJECT_ID) {
                next(new cinerino.factory.errors.Forbidden(`client for ${project.id} forbidden`));

                return;
            }
        }
    }

    // プロジェクトが決定すればリクエストに設定
    if (project !== undefined) {
        req.project = project;
    }

    next();
});

// プロジェクト指定ルーティング配下については、すべてreq.projectを上書き
setProjectRouter.use(
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

        req.project = { typeOf: cinerino.factory.organizationType.Project, id: req.params.id };

        next();
    }
);

export default setProjectRouter;
