/**
 * 会員プログラム登録タスク
 */
import * as cinerino from '@cinerino/domain';

import { connectMongo } from '../../../connectMongo';

export default async () => {
    const connection = await connectMongo({ defaultConnection: false });

    const redisClient = cinerino.redis.createClient({
        host: <string>process.env.REDIS_HOST,
        // tslint:disable-next-line:no-magic-numbers
        port: parseInt(<string>process.env.REDIS_PORT, 10),
        password: <string>process.env.REDIS_KEY,
        tls: { servername: <string>process.env.REDIS_HOST }
    });

    let count = 0;

    const MAX_NUBMER_OF_PARALLEL_TASKS = 10;
    const INTERVAL_MILLISECONDS = 200;
    const taskRepo = new cinerino.repository.Task(connection);
    const cognitoIdentityServiceProvider = new cinerino.AWS.CognitoIdentityServiceProvider({
        apiVersion: 'latest',
        region: 'ap-northeast-1',
        credentials: new cinerino.AWS.Credentials({
            accessKeyId: <string>process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: <string>process.env.AWS_SECRET_ACCESS_KEY
        })
    });

    setInterval(
        async () => {
            if (count > MAX_NUBMER_OF_PARALLEL_TASKS) {
                return;
            }

            count += 1;

            try {
                await cinerino.service.task.executeByName(
                    cinerino.factory.taskName.RegisterProgramMembership
                )({
                    taskRepo: taskRepo,
                    connection: connection,
                    redisClient: redisClient,
                    cognitoIdentityServiceProvider: cognitoIdentityServiceProvider
                });
            } catch (error) {
                console.error(error);
            }

            count -= 1;
        },
        INTERVAL_MILLISECONDS
    );
};
