/**
 * telemetryルーター
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';
import * as moment from 'moment';

import authentication from '../middlewares/authentication';
import permitScopes from '../middlewares/permitScopes';
import validator from '../middlewares/validator';

const telemetryRouter = Router();
telemetryRouter.use(authentication);
telemetryRouter.get(
    '/:telemetryType',
    permitScopes(['admin']),
    validator,
    async (req, res, next) => {
        try {
            const telemetryRepo = new cinerino.repository.Telemetry(cinerino.mongoose.connection);
            const datas = await cinerino.service.report.telemetry.search({
                telemetryType: req.params.telemetryType,
                measureFrom: moment(req.query.measureFrom).toDate(),
                measureThrough: moment(req.query.measureThrough).toDate(),
                scope: cinerino.service.report.telemetry.TelemetryScope.Global
            })({ telemetry: telemetryRepo });
            res.json(datas);
        } catch (error) {
            next(error);
        }
    }
);
export default telemetryRouter;
