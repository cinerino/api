"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * スコープ許可ミドルウェア
 */
const cinerino = require("@cinerino/domain");
const createDebug = require("debug");
const debug = createDebug('cinerino-api:middlewares');
exports.SCOPE_ADMIN = 'admin';
exports.SCOPE_CUSTOMER = 'customer';
exports.SCOPE_COGNITO_USER_ADMIN = 'aws.cognito.signin.user.admin';
const CLIENTS_AS_ADMIN = (process.env.CLIENTS_AS_ADMIN !== undefined)
    ? /* istanbul ignore next */ process.env.CLIENTS_AS_ADMIN.split(',')
    : [];
const CLIENTS_AS_CUSTOMER = (process.env.CLIENTS_AS_CUSTOMER !== undefined)
    ? /* istanbul ignore next */ process.env.CLIENTS_AS_CUSTOMER.split(',')
    : [];
exports.default = (specifiedPermittedScopes) => {
    return (req, __, next) => {
        if (process.env.RESOURCE_SERVER_IDENTIFIER === undefined) {
            next(new Error('RESOURCE_SERVER_IDENTIFIER undefined'));
            return;
        }
        const ADMIN_ADDITIONAL_PERMITTED_SCOPES = (process.env.ADMIN_ADDITIONAL_PERMITTED_SCOPES !== undefined)
            ? /* istanbul ignore next */ process.env.ADMIN_ADDITIONAL_PERMITTED_SCOPES.split(',')
            : [];
        const CUSTOMER_ADDITIONAL_PERMITTED_SCOPES = (process.env.CUSTOMER_ADDITIONAL_PERMITTED_SCOPES !== undefined)
            ? /* istanbul ignore next */ process.env.CUSTOMER_ADDITIONAL_PERMITTED_SCOPES.split(',')
            : [];
        let permittedScopes = [...specifiedPermittedScopes];
        // SCOPE_ADMINは全アクセス許可
        permittedScopes.push(exports.SCOPE_ADMIN);
        permittedScopes = [...new Set(permittedScopes)];
        debug('permittedScopes:', permittedScopes);
        debug('req.user.scopes:', req.user.scopes);
        req.isAdmin =
            req.user.scopes.indexOf(`${process.env.RESOURCE_SERVER_IDENTIFIER}/${exports.SCOPE_ADMIN}`) >= 0
                || ADMIN_ADDITIONAL_PERMITTED_SCOPES.some((scope) => req.user.scopes.indexOf(scope) >= 0);
        // ドメインつきのカスタムスコープリストを許容するように変更
        const permittedScopesWithResourceServerIdentifier = [
            ...permittedScopes.map((permittedScope) => `${process.env.RESOURCE_SERVER_IDENTIFIER}/${permittedScope}`),
            ...permittedScopes.map((permittedScope) => `${process.env.RESOURCE_SERVER_IDENTIFIER}/auth/${permittedScope}`)
        ];
        // 管理者の追加許可スコープをセット
        permittedScopesWithResourceServerIdentifier.push(...ADMIN_ADDITIONAL_PERMITTED_SCOPES);
        // 会員の場合、追加許可スコープをセット
        // tslint:disable-next-line:no-single-line-block-comment
        /* istanbul ignore if */
        if (permittedScopes.indexOf(exports.SCOPE_CUSTOMER) >= 0) {
            permittedScopesWithResourceServerIdentifier.push(...CUSTOMER_ADDITIONAL_PERMITTED_SCOPES);
        }
        // tslint:disable-next-line:no-single-line-block-comment
        /* istanbul ignore if */
        if (req.user.scopes.indexOf(exports.SCOPE_COGNITO_USER_ADMIN) >= 0) {
            // aws.cognito.signin.user.adminスコープのみでadminとして認定するクライアント
            // tslint:disable-next-line:no-single-line-block-comment
            /* istanbul ignore if */
            if (CLIENTS_AS_ADMIN.indexOf(req.user.client_id) >= 0) {
                req.user.scopes.push(exports.SCOPE_ADMIN);
            }
            // aws.cognito.signin.user.adminスコープのみでcustomerとして認定するクライアント
            // tslint:disable-next-line:no-single-line-block-comment
            /* istanbul ignore if */
            if (CLIENTS_AS_CUSTOMER.indexOf(req.user.client_id) >= 0) {
                req.user.scopes.push(exports.SCOPE_CUSTOMER);
            }
        }
        // スコープチェック
        try {
            debug('checking scope requirements...', permittedScopesWithResourceServerIdentifier);
            if (!isScopesPermitted(req.user.scopes, permittedScopesWithResourceServerIdentifier)) {
                next(new cinerino.factory.errors.Forbidden('scope requirements not satisfied'));
            }
            else {
                next();
            }
        }
        catch (error) {
            next(error);
        }
    };
};
/**
 * 所有スコープが許可されたスコープかどうか
 */
function isScopesPermitted(ownedScopes, permittedScopes) {
    if (!Array.isArray(ownedScopes)) {
        throw new Error('ownedScopes should be array of string');
    }
    const permittedOwnedScope = permittedScopes.find((permittedScope) => ownedScopes.indexOf(permittedScope) >= 0);
    return (permittedOwnedScope !== undefined);
}
