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
 * 非同期ジョブ
 */
const run_1 = require("./continuous/abortTasks/run");
const run_2 = require("./continuous/makeTransactionExpired/run");
const run_3 = require("./continuous/reexportTransactionTasks/run");
const run_4 = require("./continuous/retryTasks/run");
const run_5 = require("./continuous/onTransactionCanceled/run");
const run_6 = require("./continuous/onTransactionConfirmed/run");
const run_7 = require("./continuous/onTransactionExpired/run");
const run_8 = require("./continuous/cancelReservation/run");
const run_9 = require("./continuous/confirmReservation/run");
const run_10 = require("./continuous/createOrderReport/run");
const run_11 = require("./continuous/deleteMember/run");
const run_12 = require("./continuous/givePointAward/run");
const run_13 = require("./continuous/moneyTransfer/run");
const run_14 = require("./continuous/orderProgramMembership/run");
const run_15 = require("./continuous/pay/run");
const run_16 = require("./continuous/placeOrder/run");
const run_17 = require("./continuous/refund/run");
const run_18 = require("./continuous/registerService/run");
const run_19 = require("./continuous/returnOrder/run");
const run_20 = require("./continuous/returnPointAward/run");
const run_21 = require("./continuous/sendEmailMessage/run");
const run_22 = require("./continuous/sendOrder/run");
const run_23 = require("./continuous/triggerWebhook/run");
const run_24 = require("./continuous/unRegisterProgramMembership/run");
const run_25 = require("./continuous/voidMoneyTransfer/run");
const run_26 = require("./continuous/voidPayment/run");
const run_27 = require("./continuous/voidRegisterService/run");
const run_28 = require("./continuous/voidReserve/run");
exports.default = () => __awaiter(void 0, void 0, void 0, function* () {
    yield run_1.default({});
    yield run_4.default({});
    yield run_2.default({});
    yield run_3.default({});
    yield run_5.default({});
    yield run_6.default({});
    yield run_7.default({});
    yield run_8.default({});
    yield run_9.default({});
    yield run_10.default({});
    yield run_11.default({});
    yield run_12.default({});
    yield run_13.default({});
    yield run_14.default({});
    yield run_15.default({});
    yield run_16.default({});
    yield run_17.default({});
    yield run_18.default({});
    yield run_19.default({});
    yield run_20.default({});
    yield run_21.default({});
    yield run_22.default({});
    yield run_23.default({});
    yield run_24.default({});
    yield run_25.default({});
    yield run_26.default({});
    yield run_27.default({});
    yield run_28.default({});
});
