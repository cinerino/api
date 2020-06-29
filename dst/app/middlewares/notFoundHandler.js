"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * 404ハンドラーミドルウェア
 */
const cinerino = require("@cinerino/domain");
exports.default = (req, __, next) => {
    next(new cinerino.factory.errors.NotFound(`router for [${req.originalUrl}]`));
};
