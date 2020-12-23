"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPassportValidator = exports.validateWaiterPassport = void 0;
/**
 * WAITER許可証検証バリデーターミドルウェア
 */
const cinerino = require("@cinerino/domain");
const WAITER_DISABLED = process.env.WAITER_DISABLED === '1';
const WAITER_PASSPORT_ISSUER = process.env.WAITER_PASSPORT_ISSUER;
const WAITER_SECRET = process.env.WAITER_SECRET;
function validateWaiterPassport(req, __, next) {
    var _a, _b, _c;
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
    const passportToken = (_c = (_b = (_a = req.body) === null || _a === void 0 ? void 0 : _a.object) === null || _b === void 0 ? void 0 : _b.passport) === null || _c === void 0 ? void 0 : _c.token;
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
exports.validateWaiterPassport = validateWaiterPassport;
function createPassportValidator(params) {
    return (validatorParams) => {
        var _a;
        // 許可証発行者確認
        const validIssuer = validatorParams.passport.iss === WAITER_PASSPORT_ISSUER;
        // スコープのフォーマットは、Transaction:${TransactionType}:${sellerId}
        const newExplodedScopeStrings = validatorParams.passport.scope.split(':');
        const isNewValidScope = (newExplodedScopeStrings[0] === 'Transaction' && // スコープ接頭辞確認
            newExplodedScopeStrings[1] === params.transaction.typeOf && // スコープ接頭辞確認
            (
            // tslint:disable-next-line:no-magic-numbers
            newExplodedScopeStrings[2] === params.seller.id || newExplodedScopeStrings[2] === '*' // 販売者ID確認
            ));
        // 追加特性に登録されたwaiterScopeでもok
        const validScopesByAdditionalProperty = (_a = params.seller.additionalProperty) === null || _a === void 0 ? void 0 : _a.filter((p) => p.name === 'waiterScope').map((p) => p.value);
        const isValidByAdditionalProperty = (Array.isArray(validScopesByAdditionalProperty))
            ? validScopesByAdditionalProperty === null || validScopesByAdditionalProperty === void 0 ? void 0 : validScopesByAdditionalProperty.includes(validatorParams.passport.scope) : false;
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
exports.createPassportValidator = createPassportValidator;
