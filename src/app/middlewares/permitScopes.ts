/**
 * スコープ許可ミドルウェア
 */
import * as cinerino from '@cinerino/domain';
import * as createDebug from 'debug';
import { NextFunction, Request, Response } from 'express';

import { } from '../../@types/index';

import { Permission } from '../iam';

const debug = createDebug('cinerino-api:middlewares');

export const SCOPE_COGNITO_USER_ADMIN = 'aws.cognito.signin.user.admin';

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

        let permittedScopes = [...specifiedPermittedScopes];

        // Permission.Adminは全アクセス許可
        permittedScopes.push(Permission.Admin);

        permittedScopes = [...new Set(permittedScopes)];
        debug('permittedScopes:', permittedScopes);

        const ownedScopes: string[] = [...req.user.scopes, ...req.memberPermissions];

        // tslint:disable-next-line:no-single-line-block-comment
        /* istanbul ignore if */
        if (ownedScopes.indexOf(SCOPE_COGNITO_USER_ADMIN) >= 0) {
            // aws.cognito.signin.user.adminスコープのみでcustomerとして認定するクライアント
            // tslint:disable-next-line:no-single-line-block-comment
            /* istanbul ignore if */
            if (CLIENTS_AS_CUSTOMER.indexOf(req.user.client_id) >= 0) {
                ownedScopes.push(`${RESOURCE_SERVER_IDENTIFIER}/${Permission.Customer}`);
            }
        }

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
            } else {
                next();
            }
        } catch (error) {
            // tslint:disable-next-line:no-single-line-block-comment
            /* istanbul ignore next */
            next(error);
        }
    };
};

/**
 * 所有スコープが許可されたスコープかどうか
 */
function isScopesPermitted(ownedScopes: string[], permittedScopes: string[]) {
    const permittedOwnedScope = permittedScopes.find((permittedScope) => ownedScopes.indexOf(permittedScope) >= 0);

    return (permittedOwnedScope !== undefined);
}
