/**
 * 上映イベントインポートタスク作成
 */
import * as cinerino from '@cinerino/domain';
import { CronJob } from 'cron';
import * as createDebug from 'debug';
import * as moment from 'moment';
import * as os from 'os';
import * as util from 'util';

import { connectMongo } from '../../../connectMongo';
import * as singletonProcess from '../../../singletonProcess';

const debug = createDebug('cinerino-api:jobs');
/**
 * 上映イベントを何週間後までインポートするか
 */
const LENGTH_IMPORT_SCREENING_EVENTS_IN_WEEKS = (process.env.LENGTH_IMPORT_SCREENING_EVENTS_IN_WEEKS !== undefined)
    // tslint:disable-next-line:no-magic-numbers
    ? parseInt(process.env.LENGTH_IMPORT_SCREENING_EVENTS_IN_WEEKS, 10)
    : 1;

const MAX_IMPORT_EVENTS_INTERVAL_IN_MINUTES = 60;
const IMPORT_EVENTS_INTERVAL_IN_MINUTES = (process.env.IMPORT_EVENTS_INTERVAL_IN_MINUTES !== undefined)
    ? Math.min(Number(process.env.IMPORT_EVENTS_INTERVAL_IN_MINUTES), MAX_IMPORT_EVENTS_INTERVAL_IN_MINUTES)
    : MAX_IMPORT_EVENTS_INTERVAL_IN_MINUTES;

export default async () => {
    let holdSingletonProcess = false;
    setInterval(
        async () => {
            holdSingletonProcess = await singletonProcess.lock({ key: 'createImportScreeningEventsTask', ttl: 60 });
        },
        // tslint:disable-next-line:no-magic-numbers
        10000
    );

    const connection = await connectMongo({ defaultConnection: false });

    const job = new CronJob(
        `*/${IMPORT_EVENTS_INTERVAL_IN_MINUTES} * * * *`,
        async () => {
            if (process.env.DEBUG_SINGLETON_PROCESS === '1') {
                await cinerino.service.notification.report2developers(
                    `[${process.env.PROJECT_ID}] api:singletonProcess`,
                    util.format(
                        '%s\n%s\n%s\n%s\n%s',
                        `key: 'createImportScreeningEventsTask'`,
                        `IMPORT_EVENTS_INTERVAL_IN_MINUTES: ${IMPORT_EVENTS_INTERVAL_IN_MINUTES}`,
                        `holdSingletonProcess: ${holdSingletonProcess}`,
                        `os.hostname: ${os.hostname}`,
                        `pid: ${process.pid}`
                    )
                )();
            }

            if (process.env.IMPORT_EVENTS_STOPPED === '1') {
                return;
            }

            if (!holdSingletonProcess) {
                return;
            }

            const taskRepo = new cinerino.repository.Task(connection);
            const sellerRepo = new cinerino.repository.Seller(connection);

            // 全劇場組織を取得
            const sellers = await sellerRepo.search({});
            const importFrom = moment()
                .toDate();
            const importThrough = moment()
                .add(LENGTH_IMPORT_SCREENING_EVENTS_IN_WEEKS, 'weeks')
                .toDate();
            const runsAt = new Date();
            await Promise.all(sellers.map(async (movieTheater) => {
                try {
                    if (Array.isArray(movieTheater.makesOffer)) {
                        await Promise.all(movieTheater.makesOffer.map(async (offer) => {
                            const taskAttributes: cinerino.factory.task.IAttributes<cinerino.factory.taskName.ImportScreeningEvents> = {
                                name: cinerino.factory.taskName.ImportScreeningEvents,
                                status: cinerino.factory.taskStatus.Ready,
                                runsAt: runsAt,
                                remainingNumberOfTries: 1,
                                numberOfTried: 0,
                                executionResults: [],
                                data: {
                                    locationBranchCode: offer.itemOffered.reservationFor.location.branchCode,
                                    offeredThrough: offer.offeredThrough,
                                    importFrom: importFrom,
                                    importThrough: importThrough
                                }
                            };
                            await taskRepo.save(taskAttributes);
                        }));
                    }
                } catch (error) {
                    console.error(error);
                }
            }));
        },
        undefined,
        true
    );
    debug('job started', job);
};
