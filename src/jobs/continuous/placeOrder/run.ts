/**
 * 注文作成
 */
import * as cinerino from '@cinerino/domain';

import { connectMongo } from '../../../connectMongo';

export default async (params: {
    project?: cinerino.factory.project.IProject;
}) => {
    const connection = await connectMongo({ defaultConnection: false });

    let count = 0;

    const MAX_NUBMER_OF_PARALLEL_TASKS = 10;
    const INTERVAL_MILLISECONDS = 200;

    setInterval(
        async () => {
            if (count > MAX_NUBMER_OF_PARALLEL_TASKS) {
                return;
            }

            count += 1;

            try {
                await cinerino.service.task.executeByName({
                    project: params.project,
                    name: cinerino.factory.taskName.PlaceOrder
                })({
                    connection: connection
                });
            } catch (error) {
                console.error(error);
            }

            count -= 1;
        },
        INTERVAL_MILLISECONDS
    );

    // 同時実行タスク数監視
    setInterval(
        async () => {
            if (count > MAX_NUBMER_OF_PARALLEL_TASKS) {
                await cinerino.service.notification.report2developers(
                    `api:connectMongo`,
                    `jobs:placeOrder:taskCount reached MAX_NUBMER_OF_PARALLEL_TASKS. ${count.toString()}`
                )();
            }
        },
        // tslint:disable-next-line:no-magic-numbers
        60000
    );
};
