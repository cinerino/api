"use strict";
/**
 * 404ハンドラーミドルウェア
 * @module middlewares.notFoundHandler
 */
Object.defineProperty(exports, "__esModule", { value: true });
const cinerino = require("@cinerino/domain");
exports.default = (req, __, next) => {
    next(new cinerino.factory.errors.NotFound(`router for [${req.originalUrl}]`));
};
