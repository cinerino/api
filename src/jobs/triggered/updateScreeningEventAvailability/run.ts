/**
 * パフォーマンス空席状況を更新する
 * COA空席情報から空席状況を生成してredisに保管する
 */
import * as cinerino from '@cinerino/domain';
import { CronJob } from 'cron';
import * as createDebug from 'debug';
import * as moment from 'moment';

import { connectMongo } from '../../../connectMongo';
import * as singletonProcess from '../../../singletonProcess';

const debug = createDebug('cinerino-api:jobs');

/**
 * 上映イベントを何週間後までインポートするか
 */
const LENGTH_IMPORT_SCREENING_EVENTS_IN_WEEKS = (process.env.LENGTH_IMPORT_SCREENING_EVENTS_IN_WEEKS !== undefined)
    ? Number(process.env.LENGTH_IMPORT_SCREENING_EVENTS_IN_WEEKS)
    : 1;

export default async () => {
    // Cinemasunshineのみでこのタスクは使用
    if (process.env.USE_REDIS_EVENT_ITEM_AVAILABILITY_REPO !== '1') {
        return;
    }

    let holdSingletonProcess = false;
    setInterval(
        async () => {
            // tslint:disable-next-line:no-magic-numbers
            holdSingletonProcess = await singletonProcess.lock({ key: 'updateScreeningEventAvailability', ttl: 60 });
        },
        // tslint:disable-next-line:no-magic-numbers
        10000
    );

    const connection = await connectMongo({ defaultConnection: false });

    const redisClient = cinerino.redis.createClient({
        host: <string>process.env.REDIS_HOST,
        // tslint:disable-next-line:no-magic-numbers
        port: Number(<string>process.env.REDIS_PORT),
        password: <string>process.env.REDIS_KEY,
        tls: (process.env.REDIS_TLS_SERVERNAME !== undefined) ? { servername: process.env.REDIS_TLS_SERVERNAME } : undefined
    });

    const job = new CronJob(
        '* * * * *',
        async () => {
            if (!holdSingletonProcess) {
                return;
            }

            const itemAvailabilityRepo = new cinerino.repository.itemAvailability.ScreeningEvent(redisClient);
            const sellerRepo = new cinerino.repository.Seller(connection);

            // 販売者ごとにイベント在庫状況を更新
            const sellers = await sellerRepo.search({});
            const startFrom = moment()
                .toDate();
            const startThrough = moment()
                .add(LENGTH_IMPORT_SCREENING_EVENTS_IN_WEEKS, 'weeks')
                .toDate();
            await Promise.all(sellers.map(async (seller) => {
                try {
                    if (seller.location !== undefined && seller.location.branchCode !== undefined) {
                        await cinerino.service.offer.updateEventItemAvailability(
                            seller.location.branchCode,
                            startFrom,
                            startThrough
                        )({ itemAvailability: itemAvailabilityRepo });
                        debug('item availability updated');
                    }
                } catch (error) {
                    // tslint:disable-next-line:no-console
                    console.error(error);
                }
            }));
        },
        undefined,
        true
    );
    debug('job started', job);
};
