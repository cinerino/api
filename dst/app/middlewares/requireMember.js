"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * 会員必須ミドルウェア
 */
const cinerino = require("@cinerino/domain");
const createDebug = require("debug");
const debug = createDebug('cinerino-api:middlewares');
exports.default = (req, __, next) => {
    // 会員としてログイン済みであればOK
    if (isMember(req)) {
        debug('logged in as', req.user.sub);
        next();
    }
    else {
        next(new cinerino.factory.errors.Forbidden('login required'));
    }
};
function isMember(req) {
    // req.canReadPeopleMeで判定
    return req.canReadPeopleMe === true && typeof req.user.username === 'string';
}
