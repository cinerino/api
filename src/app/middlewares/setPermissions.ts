/**
 * 権限セットミドルウェア
 */
import * as cinerino from '@cinerino/domain';
import { NextFunction, Request, Response } from 'express';
import * as mongoose from 'mongoose';

const RESOURCE_SERVER_IDENTIFIER = <string>process.env.RESOURCE_SERVER_IDENTIFIER;

export default async (req: Request, _: Response, next: NextFunction) => {
    try {
        let isProjectMember = false;
        let memberPermissions: string[] = [];
        const customerPermissions: string[] = [];

        const memberRepo = new cinerino.repository.Member(mongoose.connection);
        const roleRepo = new cinerino.repository.Role(mongoose.connection);

        // プロジェクトが決定していれば権限をセット
        if (req.project !== undefined && req.project !== null && typeof req.project.id === 'string') {
            // プロジェクト決定済のリクエストに対してプロジェクトメンバー権限を決定する
            memberPermissions = await cinerino.service.iam.searchPermissions({
                project: { id: req.project.id },
                member: { id: req.user.sub }
            })({
                member: memberRepo,
                role: roleRepo
            });
            memberPermissions = memberPermissions.map((p) => `${RESOURCE_SERVER_IDENTIFIER}/${p}`);

            if (memberPermissions.length === 0) {
                // プロジェクトメンバーが見つからない場合、アプリケーションクライアントとして権限検索
                memberPermissions = await cinerino.service.iam.searchPermissions({
                    project: { id: req.project.id },
                    member: { id: req.user.client_id }
                })({
                    member: memberRepo,
                    role: roleRepo
                });
                memberPermissions = memberPermissions.map((p) => `${RESOURCE_SERVER_IDENTIFIER}/${p}`);
            }

            isProjectMember = await checkProjectMember({
                project: { id: req.project.id },
                member: { id: req.user.sub }
            })({
                member: memberRepo
            });
        }

        req.customerPermissions = customerPermissions;
        req.memberPermissions = memberPermissions;
        req.isProjectMember = isProjectMember;

        next();
    } catch (error) {
        next(error);
    }
};

function checkProjectMember(params: {
    project: { id: string };
    member: { id: string };
}) {
    return async (repos: {
        member: cinerino.repository.Member;
    }) => {
        let isMember = false;

        const members = await repos.member.search({
            project: { id: { $eq: params.project.id } },
            member: { id: { $eq: params.member.id } }
        });
        if (members.length > 0) {
            const member = members[0];

            // メンバータイプが`Person`かつロールを持っていればプロジェクトメンバー
            isMember = member.member.typeOf === cinerino.factory.personType.Person
                && Array.isArray(member.member.hasRole)
                && member.member.hasRole.length > 0;
        }

        return isMember;
    };
}
