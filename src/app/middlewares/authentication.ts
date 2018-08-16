/**
 * OAuthミドルウェア
 * @see https://aws.amazon.com/blogs/mobile/integrating-amazon-cognito-user-pools-with-api-gateway/
 */
import * as cinerino from '@cinerino/domain';
import { cognitoAuth } from '@motionpicture/express-middleware';
import { NextFunction, Request, Response } from 'express';

// 許可発行者リスト
const ISSUERS = (<string>process.env.TOKEN_ISSUERS).split(',');

// tslint:disable-next-line:no-single-line-block-comment
/* istanbul ignore next */
export default async (req: Request, res: Response, next: NextFunction) => {
    try {
        await cognitoAuth({
            issuers: ISSUERS,
            authorizedHandler: async (user, token) => {
                req.user = user;
                req.accessToken = token;
                req.agent = {
                    typeOf: cinerino.factory.personType.Person,
                    id: user.sub,
                    memberOf: (user.username !== undefined) ? {
                        typeOf: <cinerino.factory.programMembership.ProgramMembershipType>'ProgramMembership',
                        membershipNumber: user.username,
                        programName: 'Amazon Cognito',
                        award: [],
                        url: user.iss
                    } : undefined
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
