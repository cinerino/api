/**
 * イベント席数更新タスク作成
 */
import * as cinerino from '@cinerino/domain';
import { CronJob } from 'cron';
import * as createDebug from 'debug';
import * as moment from 'moment';

import { connectMongo } from '../../../connectMongo';
import * as singletonProcess from '../../../singletonProcess';

const project: cinerino.factory.project.IProject = { typeOf: 'Project', id: <string>process.env.PROJECT_ID };

const debug = createDebug('cinerino-api:jobs');
/**
 * 上映イベントを何週間後までインポートするか
 */
const LENGTH_IMPORT_SCREENING_EVENTS_IN_WEEKS = (process.env.LENGTH_IMPORT_SCREENING_EVENTS_IN_WEEKS !== undefined)
    ? Number(process.env.LENGTH_IMPORT_SCREENING_EVENTS_IN_WEEKS)
    : 1;

export default async () => {
    let holdSingletonProcess = false;
    setInterval(
        async () => {
            holdSingletonProcess = await singletonProcess.lock({ key: 'createUpdateEventAttendeeCapacityTask', ttl: 60 });
        },
        // tslint:disable-next-line:no-magic-numbers
        10000
    );

    const connection = await connectMongo({ defaultConnection: false });

    const job = new CronJob(
        `* * * * *`,
        async () => {
            if (process.env.IMPORT_EVENTS_STOPPED === '1') {
                return;
            }

            if (!holdSingletonProcess) {
                return;
            }

            const taskRepo = new cinerino.repository.Task(connection);
            const sellerRepo = new cinerino.repository.Seller(connection);

            const sellers = await sellerRepo.search({});
            const importFrom = moment()
                .toDate();
            const importThrough = moment()
                .add(LENGTH_IMPORT_SCREENING_EVENTS_IN_WEEKS, 'weeks')
                .toDate();
            const runsAt = new Date();
            await Promise.all(sellers.map(async (seller) => {
                try {
                    if (Array.isArray(seller.makesOffer)) {
                        await Promise.all(seller.makesOffer.map(async (offer) => {
                            const taskAttributes: cinerino.factory.task.IAttributes<cinerino.factory.taskName.UpdateEventAttendeeCapacity>
                                = {
                                name: cinerino.factory.taskName.UpdateEventAttendeeCapacity,
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
                                },
                                project: project
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
