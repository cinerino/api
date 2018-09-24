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
 * telemetryルーター
 */
const cinerino = require("@cinerino/domain");
const express_1 = require("express");
const moment = require("moment");
const authentication_1 = require("../middlewares/authentication");
const permitScopes_1 = require("../middlewares/permitScopes");
const validator_1 = require("../middlewares/validator");
const telemetryRouter = express_1.Router();
telemetryRouter.use(authentication_1.default);
telemetryRouter.get('/:telemetryType', permitScopes_1.default(['admin']), validator_1.default, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const telemetryRepo = new cinerino.repository.Telemetry(cinerino.mongoose.connection);
        const datas = yield cinerino.service.report.telemetry.search({
            telemetryType: req.params.telemetryType,
            measureFrom: moment(req.query.measureFrom).toDate(),
            measureThrough: moment(req.query.measureThrough).toDate(),
            scope: cinerino.service.report.telemetry.TelemetryScope.Global
        })({ telemetry: telemetryRepo });
        res.json(datas);
    }
    catch (error) {
        next(error);
    }
}));
exports.default = telemetryRouter;
