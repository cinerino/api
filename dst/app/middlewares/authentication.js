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
                req.user = user;
                req.accessToken = token;
                req.agent = {
                    typeOf: cinerino.factory.personType.Person,
                    id: user.sub,
                    memberOf: (user.username !== undefined) ? {
                        typeOf: 'ProgramMembership',
                        membershipNumber: user.username,
                        programName: 'Amazon Cognito',
                        award: [],
                        url: user.iss
                    } : undefined
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
