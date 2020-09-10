/**
 * リクエストプロジェクト設定ルーター
 */
import * as cinerino from '@cinerino/domain';
import * as express from 'express';
import * as mongoose from 'mongoose';

const setProject = express.Router();

setProject.use(async (req, _, next) => {
    let project: cinerino.factory.project.IProject | undefined;

    // アプリケーションクライアントが権限を持つプロジェクトが1つのみであれば、プロジェクトセット
    const memberRepo = new cinerino.repository.Member(mongoose.connection);
    // const applicationMemberCount = await memberRepo.count({
    //     member: { id: { $eq: req.user.client_id } }
    // });
    const applicationMembers = await memberRepo.search({
        limit: 2,
        member: { id: { $eq: req.user.client_id } }
    });

    if (applicationMembers.length === 1) {
        // const applicationMember = await memberRepo.search({
        //     member: { id: { $eq: req.user.client_id } }
        // });
        project = { typeOf: applicationMembers[0].project.typeOf, id: applicationMembers[0].project.id };
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
        req.project = { typeOf: cinerino.factory.chevre.organizationType.Project, id: req.params.id };

        next();
    }
);

export default setProject;
