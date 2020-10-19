/**
 * 取引期限監視
 */
import * as cinerino from '@cinerino/domain';
import * as moment from 'moment';

import { connectMongo } from '../../../connectMongo';

export default async (params: {
    project?: cinerino.factory.project.IProject;
}) => {
    const connection = await connectMongo({ defaultConnection: false });

    let count = 0;

    const MAX_NUBMER_OF_PARALLEL_TASKS = 10;
    const INTERVAL_MILLISECONDS = 1000;
    const transactionRepo = new cinerino.repository.Transaction(connection);

    setInterval(
        async () => {
            if (count > MAX_NUBMER_OF_PARALLEL_TASKS) {
                return;
            }

            count += 1;

            try {
                await transactionRepo.makeExpired({ project: params.project });

                // 過去の不要な期限切れ取引を削除する
                await transactionRepo.transactionModel.deleteMany({
                    startDate: {
                        $lt: moment()
                            // tslint:disable-next-line:no-magic-numbers
                            .add(-3, 'days')
                            .toDate()
                    },
                    status: cinerino.factory.transactionStatusType.Expired,
                    tasksExportationStatus: cinerino.factory.transactionTasksExportationStatus.Exported
                })
                    .exec();
            } catch (error) {
                console.error(error);
            }

            count -= 1;
        },
        INTERVAL_MILLISECONDS
    );
};
