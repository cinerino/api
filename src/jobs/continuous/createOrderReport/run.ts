/**
 * 注文レポート作成
 */
import * as cinerino from '@cinerino/domain';

import { connectMongo } from '../../../connectMongo';

export default async (params: {
    project?: cinerino.factory.project.IProject;
}) => {
    // 長時間処理の可能性があるので、disableCheck: true
    const connection = await connectMongo({
        defaultConnection: false,
        disableCheck: true
    });

    let count = 0;

    const MAX_NUBMER_OF_PARALLEL_TASKS = 0;
    const INTERVAL_MILLISECONDS = 10000;

    setInterval(
        async () => {
            if (count > MAX_NUBMER_OF_PARALLEL_TASKS) {
                return;
            }

            count += 1;

            try {
                await cinerino.service.task.executeByName({
                    project: params.project,
                    name: <any>'createOrderReport'
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
};
