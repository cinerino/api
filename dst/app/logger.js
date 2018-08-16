"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * ロガー
 */
const winston = require("winston");
exports.default = new (winston.Logger)({
    transports: [
        new (winston.transports.Console)({
            timestamp: true,
            level: 'error'
        })
    ]
});
