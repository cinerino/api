"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * バリデーターミドルウェア
 * リクエストのパラメータ(query strings or body parameters)に対するバリデーション
 */
const cinerino = require("@cinerino/domain");
const express_validator_1 = require("express-validator");
const http_status_1 = require("http-status");
const api_1 = require("../error/api");
exports.default = (req, __, next) => __awaiter(void 0, void 0, void 0, function* () {
    const validatorResult = express_validator_1.validationResult(req);
    if (!validatorResult.isEmpty()) {
        const errors = validatorResult.array()
            .map((mappedRrror) => {
            return new cinerino.factory.errors.Argument(mappedRrror.param, mappedRrror.msg);
        });
        next(new api_1.APIError(http_status_1.BAD_REQUEST, errors));
    }
    else {
        next();
    }
});
