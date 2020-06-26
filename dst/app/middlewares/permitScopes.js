"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SCOPE_COGNITO_USER_ADMIN = void 0;
/**
 * スコープ許可ミドルウェア
 */
const cinerino = require("@cinerino/domain");
const createDebug = require("debug");
const iam_1 = require("../iam");
const debug = createDebug('cinerino-api:middlewares');
exports.SCOPE_COGNITO_USER_ADMIN = 'aws.cognito.signin.user.admin';
exports.default = (specifiedPermittedScopes) => {
    return (req, __, next) => {
        const RESOURCE_SERVER_IDENTIFIER = process.env.RESOURCE_SERVER_IDENTIFIER;
        // tslint:disable-next-line:no-single-line-block-comment
        /* istanbul ignore if */
        if (RESOURCE_SERVER_IDENTIFIER === undefined) {
            next(new Error('RESOURCE_SERVER_IDENTIFIER undefined'));
            return;
        }
        let permittedScopes = [...specifiedPermittedScopes];
        // Permission.Adminは全アクセス許可
        permittedScopes.push(iam_1.Permission.Admin);
        permittedScopes = [...new Set(permittedScopes)];
        debug('permittedScopes:', permittedScopes);
        const ownedScopes = [...req.user.scopes, ...req.memberPermissions];
        debug('ownedScopes:', ownedScopes);
        // isAdminの条件は、プロジェクトメンバーかどうか
        req.isAdmin = req.isProjectMember === true;
        // ドメインつきのカスタムスコープリストを許容するように変更
        const permittedScopesWithResourceServerIdentifier = [
            ...permittedScopes.map((permittedScope) => `${RESOURCE_SERVER_IDENTIFIER}/${permittedScope}`),
            ...permittedScopes.map((permittedScope) => `${RESOURCE_SERVER_IDENTIFIER}/auth/${permittedScope}`)
        ];
        // スコープチェック
        try {
            debug('checking scope requirements...', permittedScopesWithResourceServerIdentifier);
            if (!isScopesPermitted(ownedScopes, permittedScopesWithResourceServerIdentifier)) {
                next(new cinerino.factory.errors.Forbidden('scope requirements not satisfied'));
            }
            else {
                next();
            }
        }
        catch (error) {
            // tslint:disable-next-line:no-single-line-block-comment
            /* istanbul ignore next */
            next(error);
        }
    };
};
/**
 * 所有スコープが許可されたスコープかどうか
 */
function isScopesPermitted(ownedScopes, permittedScopes) {
    const permittedOwnedScope = permittedScopes.find((permittedScope) => ownedScopes.indexOf(permittedScope) >= 0);
    return (permittedOwnedScope !== undefined);
}
