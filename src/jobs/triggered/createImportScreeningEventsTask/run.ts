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

const IMPORT_EVENTS_PER_WEEKS = (process.env.IMPORT_EVENTS_PER_WEEKS !== undefined)
    ? Number(process.env.IMPORT_EVENTS_PER_WEEKS)
    : 1;

const MAX_IMPORT_EVENTS_INTERVAL_IN_MINUTES = 60;

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

    const projectRepo = new cinerino.repository.Project(connection);
    const project = await projectRepo.findById({ id: params.project.id });
    const importEventsInWeeks = (project.settings !== undefined && typeof project.settings.importEventsInWeeks === 'number')
        ? project.settings.importEventsInWeeks : 1;
    const importEventsIntervalInMinutes = (project.settings !== undefined && typeof project.settings.importEventsIntervalInMinutes === 'number')
        ? Math.min(Number(project.settings.importEventsIntervalInMinutes), MAX_IMPORT_EVENTS_INTERVAL_IN_MINUTES)
        : 1;
    const importEventsStopped = project.settings !== undefined && project.settings.importEventsStopped === true;

    const job = new CronJob(
        `*/${importEventsIntervalInMinutes} * * * *`,
        // tslint:disable-next-line:max-func-body-length
        async () => {
            if (process.env.DEBUG_SINGLETON_PROCESS === '1') {
                await cinerino.service.notification.report2developers(
                    `[${process.env.PROJECT_ID}] api:singletonProcess`,
                    util.format(
                        '%s\n%s\n%s\n%s\n%s',
                        `key: 'createImportScreeningEventsTask'`,
                        `importEventsIntervalInMinutes: ${importEventsIntervalInMinutes}`,
                        `holdSingletonProcess: ${holdSingletonProcess}`,
                        `os.hostname: ${os.hostname}`,
                        `pid: ${process.pid}`
                    )
                )();
            }

            if (importEventsStopped) {
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
            await Promise.all([...Array(Math.ceil(importEventsInWeeks / IMPORT_EVENTS_PER_WEEKS))].map(async (_, i) => {
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
