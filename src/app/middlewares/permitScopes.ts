/**
 * スコープ許可ミドルウェア
 */
import * as cinerino from '@cinerino/domain';
import * as createDebug from 'debug';
import { NextFunction, Request, Response } from 'express';

const debug = createDebug('cinerino-api:middlewares');

export const SCOPE_ADMIN = 'admin';

/**
 * スコープインターフェース
 */
type IScope = string;

export default (permittedScopes: IScope[]) => {
    return (req: Request, __: Response, next: NextFunction) => {
        if (process.env.RESOURCE_SERVER_IDENTIFIER === undefined) {
            next(new Error('RESOURCE_SERVER_IDENTIFIER undefined'));

            return;
        }

        debug('req.user.scopes:', req.user.scopes);
        req.isAdmin = req.user.scopes.indexOf(`${process.env.RESOURCE_SERVER_IDENTIFIER}/${SCOPE_ADMIN}`) >= 0;

        // ドメインつきのカスタムスコープリストを許容するように変更
        const permittedScopesWithResourceServerIdentifier = [
            ...permittedScopes.map((permittedScope) => `${process.env.RESOURCE_SERVER_IDENTIFIER}/${permittedScope}`),
            ...permittedScopes.map((permittedScope) => `${process.env.RESOURCE_SERVER_IDENTIFIER}/auth/${permittedScope}`)
        ];
        // cognitoユーザー管理スコープは単体で特別扱い
        if (permittedScopes.indexOf('aws.cognito.signin.user.admin') >= 0) {
            permittedScopesWithResourceServerIdentifier.push('aws.cognito.signin.user.admin');
        }
        debug('permittedScopesWithResourceServerIdentifier:', permittedScopesWithResourceServerIdentifier);

        // スコープチェック
        try {
            debug('checking scope requirements...', permittedScopesWithResourceServerIdentifier);
            if (!isScopesPermitted(req.user.scopes, permittedScopesWithResourceServerIdentifier)) {
                next(new cinerino.factory.errors.Forbidden('scope requirements not satisfied'));
            } else {
                next();
            }
        } catch (error) {
            next(error);
        }
    };
};

/**
 * 所有スコープが許可されたスコープかどうか
 * @param ownedScopes 所有スコープリスト
 * @param permittedScopes 許可スコープリスト
 */
function isScopesPermitted(ownedScopes: string[], permittedScopes: string[]) {
    debug('checking scope requirements...', permittedScopes);
    if (!Array.isArray(ownedScopes)) {
        throw new Error('ownedScopes should be array of string');
    }

    const permittedOwnedScope = permittedScopes.find((permittedScope) => ownedScopes.indexOf(permittedScope) >= 0);

    return (permittedOwnedScope !== undefined);
}
