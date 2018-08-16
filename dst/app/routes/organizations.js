"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * 組織ルーター
 */
const cinerino = require("@cinerino/domain");
const express_1 = require("express");
const organizationsRouter = express_1.Router();
const authentication_1 = require("../middlewares/authentication");
const permitScopes_1 = require("../middlewares/permitScopes");
const validator_1 = require("../middlewares/validator");
organizationsRouter.use(authentication_1.default);
organizationsRouter.get('/movieTheater', permitScopes_1.default(['aws.cognito.signin.user.admin', 'organizations', 'organizations.read-only']), validator_1.default, (__, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const repository = new cinerino.repository.Organization(cinerino.mongoose.connection);
        yield repository.searchMovieTheaters({}).then((movieTheaters) => {
            res.json(movieTheaters);
        });
    }
    catch (error) {
        next(error);
    }
}));
organizationsRouter.get('/movieTheater/:branchCode', permitScopes_1.default(['aws.cognito.signin.user.admin', 'organizations', 'organizations.read-only']), validator_1.default, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const repository = new cinerino.repository.Organization(cinerino.mongoose.connection);
        yield repository.findMovieTheaterByBranchCode(req.params.branchCode).then((movieTheater) => {
            res.json(movieTheater);
        });
    }
    catch (error) {
        next(error);
    }
}));
exports.default = organizationsRouter;
