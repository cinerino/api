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
                const identifier: cinerino.factory.person.IIdentifier = [
                    {
                        name: 'tokenIssuer',
                        value: user.iss
                    },
                    {
                        name: 'clientId',
                        value: user.client_id
                    },
                    {
                        name: 'hostname',
                        value: req.hostname
                    }
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
                        programName: 'Amazon Cognito',
                        project: req.project,
                        typeOf: cinerino.factory.programMembership.ProgramMembershipType.ProgramMembership,
                        url: user.iss
                    };
                }

                let project: cinerino.factory.project.IProject | undefined;

                // プロジェクトアプリケーションの存在確認
                const applicationRepo = new cinerino.repository.Application(mongoose.connection);
                try {
                    const applications = await applicationRepo.search({ id: { $eq: user.client_id } });
                    if (applications.length > 0) {
                        const application = applications[0];
                        if ((<any>application).project !== undefined && (<any>application).project !== null) {
                            project = { typeOf: 'Project', id: (<any>application).project.id };
                        }
                    }
                } catch (error) {
                    // no op
                    next(error);

                    return;
                }

                // 環境変数設定が存在する場合
                if (typeof process.env.PROJECT_ID === 'string') {
                    if (project === undefined) {
                        // 環境変数
                        project = { typeOf: 'Project', id: process.env.PROJECT_ID };
                    } else {
                        // アプリケーション設定と環境変数設定両方が存在する場合、プロジェクトが異なればforbidden
                        if (project.id !== process.env.PROJECT_ID) {
                            next(new cinerino.factory.errors.Forbidden(`client for ${project.id} forbidden`));

                            return;
                        }
                    }
                }

                if (project === undefined) {
                    next(new cinerino.factory.errors.Forbidden(`project of the client unknown: ${user.client_id}`));

                    return;
                }

                req.project = project;
                req.user = user;
                req.accessToken = token;
                req.agent = {
                    typeOf: cinerino.factory.personType.Person,
                    id: user.sub,
                    memberOf: programMembership,
                    identifier: identifier
                };

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
