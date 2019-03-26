"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * OAuthミドルウェア
 * @see https://aws.amazon.com/blogs/mobile/integrating-amazon-cognito-user-pools-with-api-gateway/
 */
const cinerino = require("@cinerino/domain");
const express_middleware_1 = require("@motionpicture/express-middleware");
// 許可発行者リスト
const ISSUERS = process.env.TOKEN_ISSUERS.split(',');
// tslint:disable-next-line:no-single-line-block-comment
/* istanbul ignore next */
exports.default = (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        yield express_middleware_1.cognitoAuth({
            issuers: ISSUERS,
            authorizedHandler: (user, token) => __awaiter(this, void 0, void 0, function* () {
                const identifier = [
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
                        .filter((key) => key !== 'scopes') // scopeとデータ内容は重複するので省く
                        .map((key) => {
                        return {
                            name: String(key),
                            value: String(user[key])
                        };
                    }));
                }
                catch (error) {
                    // no op
                }
                let programMembership;
                if (user.username !== undefined) {
                    programMembership = {
                        typeOf: 'ProgramMembership',
                        membershipNumber: user.username,
                        programName: 'Amazon Cognito',
                        award: [],
                        url: user.iss
                    };
                }
                req.user = user;
                req.accessToken = token;
                req.agent = {
                    typeOf: cinerino.factory.personType.Person,
                    id: user.sub,
                    memberOf: programMembership,
                    identifier: identifier
                };
                next();
            }),
            unauthorizedHandler: (err) => {
                next(new cinerino.factory.errors.Unauthorized(err.message));
            }
        })(req, res, next);
    }
    catch (error) {
        next(new cinerino.factory.errors.Unauthorized(error.message));
    }
});
