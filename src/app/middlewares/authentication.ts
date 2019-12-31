/**
 * OAuthミドルウェア
 * @see https://aws.amazon.com/blogs/mobile/integrating-amazon-cognito-user-pools-with-api-gateway/
 */
import * as cinerino from '@cinerino/domain';
import * as mongoose from 'mongoose';

import { cognitoAuth } from '@motionpicture/express-middleware';
import { NextFunction, Request, Response } from 'express';

// 許可発行者リスト
const ISSUERS = (<string>process.env.TOKEN_ISSUERS).split(',');

// tslint:disable-next-line:no-single-line-block-comment
/* istanbul ignore next */
// tslint:disable-next-line:max-func-body-length
export default async (req: Request, res: Response, next: NextFunction) => {
    try {
        await cognitoAuth({
            issuers: ISSUERS,
            authorizedHandler: async (user, token) => {
                let project: Express.IRequestProject | undefined;
                try {
                    project = await fixRequestProject(user)({
                        application: new cinerino.repository.Application(mongoose.connection)
                    });
                } catch (error) {
                    next(error);

                    return;
                }

                const agent = await fixRequestAgent(user, req)();

                // プロジェクトが決定すればリクエストに設定
                if (project !== undefined) {
                    req.project = project;
                }
                req.agent = agent;
                req.user = user;
                req.accessToken = token;

                next();
            },
            unauthorizedHandler: (err) => {
                next(new cinerino.factory.errors.Unauthorized(err.message));
            }
        })(req, res, next);
    } catch (error) {
        next(new cinerino.factory.errors.Unauthorized(error.message));
    }
};

function fixRequestAgent(user: Express.IUser, req: Request) {
    return async (): Promise<Express.IRequestAgent> => {
        const identifier: cinerino.factory.person.IIdentifier = [
            { name: 'tokenIssuer', value: user.iss },
            { name: 'clientId', value: user.client_id },
            { name: 'hostname', value: req.hostname }
        ];

        // リクエストユーザーの属性を識別子に追加
        try {
            identifier.push(...Object.keys(user)
                .filter((key) => key !== 'scope' && key !== 'scopes') // スコープ情報はデータ量がDBの制限にはまる可能性がある
                .map((key) => {
                    return {
                        name: String(key),
                        value: String((<any>user)[key])
                    };
                }));
        } catch (error) {
            // no op
        }

        let programMembership: cinerino.factory.programMembership.IProgramMembership | undefined;
        if (user.username !== undefined) {
            programMembership = {
                award: [],
                membershipNumber: user.username,
                name: 'Default Program Membership',
                programName: 'Default Program Membership',
                project: req.project,
                typeOf: cinerino.factory.programMembership.ProgramMembershipType.ProgramMembership,
                url: user.iss
            };
        }

        // ログインユーザーであればPerson、クライアント認証であればアプリケーション
        return (programMembership !== undefined)
            ? {
                typeOf: cinerino.factory.personType.Person,
                id: user.sub,
                identifier: identifier,
                memberOf: programMembership
            }
            : {
                typeOf: <any>cinerino.factory.creativeWorkType.WebApplication,
                id: user.sub,
                identifier: identifier
            };
    };
}

function fixRequestProject(user: Express.IUser) {
    return async (repos: {
        application: cinerino.repository.Application;
    }): Promise<Express.IRequestProject | undefined> => {
        let project: cinerino.factory.project.IProject | undefined;

        // プロジェクトアプリケーションの存在確認
        try {
            const applications = await repos.application.search({ id: { $eq: user.client_id } });
            if (applications.length > 0) {
                const application = applications[0];
                if (application.project !== undefined && application.project !== null) {
                    project = { typeOf: application.project.typeOf, id: application.project.id };
                }
            }
        } catch (error) {
            throw error;
        }

        // 環境変数設定が存在する場合
        if (typeof process.env.PROJECT_ID === 'string') {
            if (project === undefined) {
                // 環境変数
                project = { typeOf: cinerino.factory.organizationType.Project, id: process.env.PROJECT_ID };
            } else {
                // アプリケーション設定と環境変数設定両方が存在する場合、プロジェクトが異なればforbidden
                if (project.id !== process.env.PROJECT_ID) {
                    throw new cinerino.factory.errors.Forbidden(`client for ${project.id} forbidden`);
                }
            }
        }

        return project;
    };
}
