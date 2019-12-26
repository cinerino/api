/**
 * スコープ許可ミドルウェア
 */
import * as cinerino from '@cinerino/domain';
import * as createDebug from 'debug';
import { NextFunction, Request, Response } from 'express';

import { } from '../../@types/index';

const debug = createDebug('cinerino-api:middlewares');

export const SCOPE_ADMIN = 'admin';
export const SCOPE_CUSTOMER = 'customer';
export const SCOPE_COGNITO_USER_ADMIN = 'aws.cognito.signin.user.admin';

const CLIENTS_AS_ADMIN: string[] = (process.env.CLIENTS_AS_ADMIN !== undefined)
    ? /* istanbul ignore next */ process.env.CLIENTS_AS_ADMIN.split(',')
    : [];
const CLIENTS_AS_CUSTOMER: string[] = (process.env.CLIENTS_AS_CUSTOMER !== undefined)
    ? /* istanbul ignore next */ process.env.CLIENTS_AS_CUSTOMER.split(',')
    : [];

/**
 * スコープインターフェース
 */
type IScope = string;

export default (specifiedPermittedScopes: IScope[]) => {
    return (req: Request, __: Response, next: NextFunction) => {
        const RESOURCE_SERVER_IDENTIFIER = process.env.RESOURCE_SERVER_IDENTIFIER;

        // tslint:disable-next-line:no-single-line-block-comment
        /* istanbul ignore if */
        if (RESOURCE_SERVER_IDENTIFIER === undefined) {
            next(new Error('RESOURCE_SERVER_IDENTIFIER undefined'));

            return;
        }

        const ADMIN_ADDITIONAL_PERMITTED_SCOPES: string[] = (process.env.ADMIN_ADDITIONAL_PERMITTED_SCOPES !== undefined)
            ? /* istanbul ignore next */ process.env.ADMIN_ADDITIONAL_PERMITTED_SCOPES.split(',')
            : [];
        const CUSTOMER_ADDITIONAL_PERMITTED_SCOPES: string[] = (process.env.CUSTOMER_ADDITIONAL_PERMITTED_SCOPES !== undefined)
            ? /* istanbul ignore next */ process.env.CUSTOMER_ADDITIONAL_PERMITTED_SCOPES.split(',')
            : [];

        let permittedScopes = [...specifiedPermittedScopes];

        // SCOPE_ADMINは全アクセス許可
        permittedScopes.push(SCOPE_ADMIN);

        permittedScopes = [...new Set(permittedScopes)];
        debug('permittedScopes:', permittedScopes);

        // tslint:disable-next-line:no-single-line-block-comment
        /* istanbul ignore if */
        if (req.user.scopes.indexOf(SCOPE_COGNITO_USER_ADMIN) >= 0) {
            // aws.cognito.signin.user.adminスコープのみでadminとして認定するクライアント
            // tslint:disable-next-line:no-single-line-block-comment
            /* istanbul ignore if */
            if (CLIENTS_AS_ADMIN.indexOf(req.user.client_id) >= 0) {
                req.user.scopes.push(`${RESOURCE_SERVER_IDENTIFIER}/${SCOPE_ADMIN}`);
            }

            // aws.cognito.signin.user.adminスコープのみでcustomerとして認定するクライアント
            // tslint:disable-next-line:no-single-line-block-comment
            /* istanbul ignore if */
            if (CLIENTS_AS_CUSTOMER.indexOf(req.user.client_id) >= 0) {
                req.user.scopes.push(`${RESOURCE_SERVER_IDENTIFIER}/${SCOPE_CUSTOMER}`);
            }
        }

        debug('req.user.scopes:', req.user.scopes);
        req.isAdmin =
            req.user.scopes.indexOf(`${RESOURCE_SERVER_IDENTIFIER}/${SCOPE_ADMIN}`) >= 0
            || ADMIN_ADDITIONAL_PERMITTED_SCOPES.some((scope) => req.user.scopes.indexOf(scope) >= 0);

        // ドメインつきのカスタムスコープリストを許容するように変更
        const permittedScopesWithResourceServerIdentifier = [
            ...permittedScopes.map((permittedScope) => `${RESOURCE_SERVER_IDENTIFIER}/${permittedScope}`),
            ...permittedScopes.map((permittedScope) => `${RESOURCE_SERVER_IDENTIFIER}/auth/${permittedScope}`)
        ];

        // 管理者の追加許可スコープをセット
        permittedScopesWithResourceServerIdentifier.push(...ADMIN_ADDITIONAL_PERMITTED_SCOPES);

        // 会員の場合、追加許可スコープをセット
        // tslint:disable-next-line:no-single-line-block-comment
        /* istanbul ignore if */
        if (permittedScopes.indexOf(SCOPE_CUSTOMER) >= 0) {
            permittedScopesWithResourceServerIdentifier.push(...CUSTOMER_ADDITIONAL_PERMITTED_SCOPES);
        }

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
 */
function isScopesPermitted(ownedScopes: string[], permittedScopes: string[]) {
    if (!Array.isArray(ownedScopes)) {
        throw new Error('ownedScopes should be array of string');
    }

    const permittedOwnedScope = permittedScopes.find((permittedScope) => ownedScopes.indexOf(permittedScope) >= 0);

    return (permittedOwnedScope !== undefined);
}
