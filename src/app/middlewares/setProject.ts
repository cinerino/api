/**
 * リクエストプロジェクト設定ルーター
 */
import * as cinerino from '@cinerino/domain';
import * as express from 'express';
import * as mongoose from 'mongoose';

const CLIENTS_MULTI_PROJECTS: string[] = (process.env.CLIENTS_MULTI_PROJECTS !== undefined)
    ? /* istanbul ignore next */ process.env.CLIENTS_MULTI_PROJECTS.split(',')
    : [];

const setProject = express.Router();

setProject.use(async (req, _, next) => {
    let project: cinerino.factory.project.IProject | undefined;

    // アプリケーションからプロジェクトをセット
    // if (req.application !== undefined && req.application !== null) {
    //     if (req.application.project !== undefined && req.application.project !== null) {
    //         project = { typeOf: req.application.project.typeOf, id: req.application.project.id };
    //     }
    // }

    // アプリケーションクライアントが権限を持つプロジェクトが1つのみであれば、プロジェクトセット
    const memberRepo = new cinerino.repository.Member(mongoose.connection);
    const applicationMemberCount = await memberRepo.count({
        member: { id: { $eq: req.user.client_id } }
    });

    if (applicationMemberCount === 1) {
        const applicationMember = await memberRepo.search({
            member: { id: { $eq: req.user.client_id } }
        });
        project = { typeOf: applicationMember[0].project.typeOf, id: applicationMember[0].project.id };
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
setProject.use(
    '/projects/:id',
    async (req, _, next) => {
        // authenticationにてアプリケーションによってプロジェクト決定済であれば、比較
        // 本番マルチテナントサービスを設置するまで保留
        // if (req.project !== undefined && req.project !== null) {
        //     if (req.project.id !== req.params.id) {
        //         next(new cinerino.factory.errors.Forbidden(`client for ${req.project.id} forbidden`));

        //         return;
        //     }
        // }

        // アプリケーションがプロジェクトに対して権限を持つかどうか確認
        if (CLIENTS_MULTI_PROJECTS.indexOf(req.user.client_id) < 0) {
            const memberRepo = new cinerino.repository.Member(mongoose.connection);
            const applicationMemberCount = await memberRepo.count({
                project: { id: { $eq: req.params.id } },
                member: { id: { $eq: req.user.client_id } }
            });
            if (applicationMemberCount !== 1) {
                next(new cinerino.factory.errors.Forbidden(`forbidden project`));
            }
        }

        req.project = { typeOf: cinerino.factory.organizationType.Project, id: req.params.id };

        next();
    }
);

export default setProject;
