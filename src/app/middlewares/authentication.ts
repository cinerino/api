/**
 * OAuthミドルウェア
 * @see https://aws.amazon.com/blogs/mobile/integrating-amazon-cognito-user-pools-with-api-gateway/
 */
import * as cinerino from '@cinerino/domain';

import { cognitoAuth } from '@motionpicture/express-middleware';
import { NextFunction, Request, Response } from 'express';

// 許可発行者リスト
const ISSUERS: string[] = (typeof process.env.TOKEN_ISSUERS === 'string') ? process.env.TOKEN_ISSUERS.split(',') : [];

// tslint:disable-next-line:no-single-line-block-comment
/* istanbul ignore next */
// tslint:disable-next-line:max-func-body-length
export default async (req: Request, res: Response, next: NextFunction) => {
    try {
        await cognitoAuth({
            issuers: ISSUERS,
            authorizedHandler: async (user, token) => {
                const identifier: cinerino.factory.person.IIdentifier = [
                    { name: 'tokenIssuer', value: user.iss },
                    { name: 'clientId', value: user.client_id },
                    { name: 'hostname', value: req.hostname },
                    ...(typeof user.username === 'string') ? [{ name: 'username', value: user.username }] : []
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

                let programMembership: cinerino.factory.chevre.programMembership.IProgramMembership | undefined;
                if (typeof user.username === 'string') {
                    programMembership = {
                        membershipNumber: user.username,
                        // name: 'Default Program Membership',
                        programName: 'Default Program Membership',
                        project: req.project,
                        typeOf: cinerino.factory.chevre.programMembership.ProgramMembershipType.ProgramMembership
                        // url: user.iss
                    };
                }

                req.user = user;
                req.accessToken = token;
                // ログインユーザーであればPerson、クライアント認証であればアプリケーション
                req.agent = (programMembership !== undefined)
                    ? {
                        typeOf: cinerino.factory.personType.Person,
                        id: user.sub,
                        identifier: identifier,
                        memberOf: programMembership
                    }
                    : {
                        typeOf: <any>cinerino.factory.chevre.creativeWorkType.WebApplication,
                        id: user.sub,
                        identifier: identifier
                    };

                // リクエストに対してChevre認証クライアントをセット
                const chevreAuthClient = new cinerino.chevre.auth.ClientCredentials({
                    domain: '',
                    clientId: '',
                    clientSecret: '',
                    scopes: [],
                    state: ''
                });
                chevreAuthClient.setCredentials({ access_token: token });
                req.chevreAuthClient = chevreAuthClient;

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
