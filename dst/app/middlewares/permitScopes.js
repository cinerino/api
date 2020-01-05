"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * スコープ許可ミドルウェア
 */
const cinerino = require("@cinerino/domain");
const createDebug = require("debug");
const iam_1 = require("../iam");
const debug = createDebug('cinerino-api:middlewares');
exports.SCOPE_COGNITO_USER_ADMIN = 'aws.cognito.signin.user.admin';
const CLIENTS_AS_ADMIN = (process.env.CLIENTS_AS_ADMIN !== undefined)
    ? /* istanbul ignore next */ process.env.CLIENTS_AS_ADMIN.split(',')
    : [];
const CLIENTS_AS_CUSTOMER = (process.env.CLIENTS_AS_CUSTOMER !== undefined)
    ? /* istanbul ignore next */ process.env.CLIENTS_AS_CUSTOMER.split(',')
    : [];
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
        const isProjectMember = Array.isArray(req.memberPermissions) && req.memberPermissions.length > 0;
        const ownedScopes = [...req.user.scopes, ...req.memberPermissions];
        // tslint:disable-next-line:no-single-line-block-comment
        /* istanbul ignore if */
        if (ownedScopes.indexOf(exports.SCOPE_COGNITO_USER_ADMIN) >= 0) {
            // aws.cognito.signin.user.adminスコープのみでadminとして認定するクライアント
            // tslint:disable-next-line:no-single-line-block-comment
            /* istanbul ignore if */
            if (CLIENTS_AS_ADMIN.indexOf(req.user.client_id) >= 0) {
                ownedScopes.push(`${RESOURCE_SERVER_IDENTIFIER}/${iam_1.Permission.Admin}`);
                ownedScopes.push(`${RESOURCE_SERVER_IDENTIFIER}/${iam_1.Permission.User}`);
            }
            // aws.cognito.signin.user.adminスコープのみでcustomerとして認定するクライアント
            // tslint:disable-next-line:no-single-line-block-comment
            /* istanbul ignore if */
            if (CLIENTS_AS_CUSTOMER.indexOf(req.user.client_id) >= 0) {
                ownedScopes.push(`${RESOURCE_SERVER_IDENTIFIER}/${iam_1.Permission.Customer}`);
            }
        }
        debug('ownedScopes:', ownedScopes);
        // isAdminの条件は、とりあえず`admin`あるいは`user`権限を持つかどうか
        req.isAdmin =
            ownedScopes.indexOf(`${RESOURCE_SERVER_IDENTIFIER}/${iam_1.Permission.Admin}`) >= 0
                || ownedScopes.indexOf(`${RESOURCE_SERVER_IDENTIFIER}/${iam_1.Permission.User}`) >= 0
                || isProjectMember;
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
