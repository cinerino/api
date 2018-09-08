"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * 自分の予約ルーター
 */
// import * as cinerino from '@cinerino/domain';
const express_1 = require("express");
// import { CREATED, NO_CONTENT } from 'http-status';
// import * as moment from 'moment';
// import permitScopes from '../../../../middlewares/permitScopes';
// import validator from '../../../../middlewares/validator';
const reservationsRouter = express_1.Router();
// const chevreAuthClient = new cinerino.chevre.auth.ClientCredentials({
//     domain: <string>process.env.CHEVRE_AUTHORIZE_SERVER_DOMAIN,
//     clientId: <string>process.env.CHEVRE_CLIENT_ID,
//     clientSecret: <string>process.env.CHEVRE_CLIENT_SECRET,
//     scopes: [],
//     state: ''
// });
exports.default = reservationsRouter;
