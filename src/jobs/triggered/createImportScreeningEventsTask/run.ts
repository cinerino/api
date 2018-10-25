/**
 * 上映イベントインポートタスク作成
 */
import * as cinerino from '@cinerino/domain';
import * as moment from 'moment';
import * as cron from 'node-cron';

import { connectMongo } from '../../../connectMongo';

/**
 * 上映イベントを何週間後までインポートするか
 */
const LENGTH_IMPORT_SCREENING_EVENTS_IN_WEEKS = (process.env.LENGTH_IMPORT_SCREENING_EVENTS_IN_WEEKS !== undefined)
    // tslint:disable-next-line:no-magic-numbers
    ? parseInt(process.env.LENGTH_IMPORT_SCREENING_EVENTS_IN_WEEKS, 10)
    : 1;

export default async () => {
    const connection = await connectMongo({ defaultConnection: false });

    cron.schedule('*/5 * * * *', async () => {
        const taskRepo = new cinerino.repository.Task(connection);
        const organizationRepo = new cinerino.repository.Organization(connection);

        // 全劇場組織を取得
        const movieTheaters = await organizationRepo.searchMovieTheaters({});
        const importFrom = moment().toDate();
        const importThrough = moment().add(LENGTH_IMPORT_SCREENING_EVENTS_IN_WEEKS, 'weeks').toDate();
        const runsAt = new Date();
        await Promise.all(movieTheaters.map(async (movieTheater) => {
            try {
                const taskAttributes: cinerino.factory.task.IAttributes<cinerino.factory.taskName.ImportScreeningEvents> = {
                    name: cinerino.factory.taskName.ImportScreeningEvents,
                    status: cinerino.factory.taskStatus.Ready,
                    runsAt: runsAt,
                    remainingNumberOfTries: 1,
                    lastTriedAt: null,
                    numberOfTried: 0,
                    executionResults: [],
                    data: {
                        locationBranchCode: movieTheater.location.branchCode,
                        importFrom: importFrom,
                        importThrough: importThrough
                    }
                };
                await taskRepo.save(taskAttributes);
            } catch (error) {
                console.error(error);
            }
        }));
    });
};
