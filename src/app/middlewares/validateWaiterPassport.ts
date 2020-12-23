/**
 * WAITER許可証検証バリデーターミドルウェア
 */
import * as cinerino from '@cinerino/domain';
import { NextFunction, Request, Response } from 'express';

const WAITER_DISABLED = process.env.WAITER_DISABLED === '1';
const WAITER_PASSPORT_ISSUER = process.env.WAITER_PASSPORT_ISSUER;
const WAITER_SECRET = process.env.WAITER_SECRET;

export function validateWaiterPassport(req: Request, __: Response, next: NextFunction) {
    if (typeof WAITER_PASSPORT_ISSUER !== 'string' || WAITER_PASSPORT_ISSUER.length < 1) {
        next(new cinerino.factory.errors.ServiceUnavailable('WAITER_PASSPORT_ISSUER undefined'));

        return;
    }
    if (typeof WAITER_SECRET !== 'string' || WAITER_SECRET.length < 1) {
        next(new cinerino.factory.errors.ServiceUnavailable('WAITER_SECRET undefined'));

        return;
    }

    if (WAITER_DISABLED) {
        next();

        return;
    }

    const passportToken = req.body?.object?.passport?.token;
    if (typeof passportToken !== 'string' || passportToken.length < 1) {
        next(new cinerino.factory.errors.ArgumentNull('object.passport.token'));

        return;
    }

    // WAITER有効設定であれば許可証をセット
    req.waiterPassport = {
        token: passportToken,
        issuer: WAITER_PASSPORT_ISSUER,
        secret: WAITER_SECRET
    };

    next();
}

export function createPassportValidator(params: {
    transaction: { typeOf: cinerino.factory.transactionType };
    seller: cinerino.factory.chevre.seller.ISeller;
    clientId?: string;
}): cinerino.service.transaction.placeOrderInProgress.IPassportValidator {
    return (validatorParams) => {
        // 許可証発行者確認
        const validIssuer = validatorParams.passport.iss === WAITER_PASSPORT_ISSUER;

        // スコープのフォーマットは、Transaction:${TransactionType}:${sellerId}
        const newExplodedScopeStrings = validatorParams.passport.scope.split(':');
        const isNewValidScope = (
            newExplodedScopeStrings[0] === 'Transaction' && // スコープ接頭辞確認
            newExplodedScopeStrings[1] === params.transaction.typeOf && // スコープ接頭辞確認
            (
                // tslint:disable-next-line:no-magic-numbers
                newExplodedScopeStrings[2] === params.seller.id || newExplodedScopeStrings[2] === '*' // 販売者ID確認
            )
        );

        // 追加特性に登録されたwaiterScopeでもok
        const validScopesByAdditionalProperty = params.seller.additionalProperty?.filter((p) => p.name === 'waiterScope')
            .map((p) => p.value);
        const isValidByAdditionalProperty = (Array.isArray(validScopesByAdditionalProperty))
            ? validScopesByAdditionalProperty?.includes(validatorParams.passport.scope)
            : false;

        // スコープスタイルはどちらか一方有効であれok
        const validScope = isNewValidScope || isValidByAdditionalProperty;

        // クライアントの有効性
        let validClient = true;
        if (typeof params.clientId === 'string') {
            if (Array.isArray(validatorParams.passport.aud) && validatorParams.passport.aud.indexOf(params.clientId) < 0) {
                validClient = false;
            }
        }

        return validIssuer && validScope && validClient;
    };
}
