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
const IMPORT_EVENTS_IN_WEEKS = (process.env.LENGTH_IMPORT_SCREENING_EVENTS_IN_WEEKS !== undefined)
    ? Number(process.env.LENGTH_IMPORT_SCREENING_EVENTS_IN_WEEKS)
    : 1;
const IMPORT_EVENTS_PER_WEEKS = (process.env.IMPORT_EVENTS_PER_WEEKS !== undefined)
    ? Number(process.env.IMPORT_EVENTS_PER_WEEKS)
    : 1;

const MAX_IMPORT_EVENTS_INTERVAL_IN_MINUTES = 60;
const IMPORT_EVENTS_INTERVAL_IN_MINUTES = (process.env.IMPORT_EVENTS_INTERVAL_IN_MINUTES !== undefined)
    ? Math.min(Number(process.env.IMPORT_EVENTS_INTERVAL_IN_MINUTES), MAX_IMPORT_EVENTS_INTERVAL_IN_MINUTES)
    : MAX_IMPORT_EVENTS_INTERVAL_IN_MINUTES;

// tslint:disable-next-line:max-func-body-length
export default async (params: {
    project: cinerino.factory.project.IProject;
}) => {
    let holdSingletonProcess = false;
    setInterval(
        async () => {
            holdSingletonProcess = await singletonProcess.lock({
                project: params.project,
                key: 'createImportScreeningEventsTask',
                ttl: 60
            });
        },
        // tslint:disable-next-line:no-magic-numbers
        10000
    );

    const connection = await connectMongo({ defaultConnection: false });

    const job = new CronJob(
        `*/${IMPORT_EVENTS_INTERVAL_IN_MINUTES} * * * *`,
        // tslint:disable-next-line:max-func-body-length
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

            const sellers = await sellerRepo.search({
                project: (params.project !== undefined) ? { ids: [params.project.id] } : undefined
            });
            const now = new Date();
            const runsAt = now;

            // 1週間ずつインポート
            // tslint:disable-next-line:prefer-array-literal
            await Promise.all([...Array(Math.ceil(IMPORT_EVENTS_IN_WEEKS / IMPORT_EVENTS_PER_WEEKS))].map(async (_, i) => {
                const importFrom = moment(now)
                    .add(i, 'weeks')
                    .toDate();
                const importThrough = moment(importFrom)
                    .add(IMPORT_EVENTS_PER_WEEKS, 'weeks')
                    .toDate();

                await Promise.all(sellers.map(async (seller) => {
                    try {
                        if (Array.isArray(seller.makesOffer)) {
                            await Promise.all(seller.makesOffer.map(async (offer) => {
                                const taskAttributes: cinerino.factory.task.IAttributes<cinerino.factory.taskName.ImportScreeningEvents> = {
                                    name: cinerino.factory.taskName.ImportScreeningEvents,
                                    status: cinerino.factory.taskStatus.Ready,
                                    runsAt: runsAt,
                                    remainingNumberOfTries: 1,
                                    numberOfTried: 0,
                                    executionResults: [],
                                    data: {
                                        project: params.project,
                                        locationBranchCode: offer.itemOffered.reservationFor.location.branchCode,
                                        offeredThrough: offer.offeredThrough,
                                        importFrom: importFrom,
                                        importThrough: importThrough
                                    },
                                    project: params.project
                                };
                                await taskRepo.save(taskAttributes);
                            }));
                        }
                    } catch (error) {
                        console.error(error);
                    }
                }));
            }));
        },
        undefined,
        true
    );
    debug('job started', job);
};
