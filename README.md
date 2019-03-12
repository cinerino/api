# Cinerino API Application

[![CircleCI](https://circleci.com/gh/cinerino/api.svg?style=svg)](https://circleci.com/gh/cinerino/api)

## Table of contents

* [Usage](#usage)
* [License](#license)

## Usage

### Environment variables

| Name                                      | Required | Value          | Purpose                                     |
| ----------------------------------------- | -------- | -------------- | ------------------------------------------- |
| `DEBUG`                                   | false    | cinerino-api:* | Debug                                       |
| `NODE_ENV`                                | true     |                | Environment name                            |
| `MONGOLAB_URI`                            | true     |                | MongoDB connection URI                      |
| `REDIS_HOST`                              | true     |                | Redis Cache host                            |
| `REDIS_PORT`                              | true     |                | Redis Cache port                            |
| `REDIS_KEY`                               | true     |                | Redis Cache key                             |
| `REDIS_TLS_SERVERNAME`                    | false    |                | Redis Cache host                            |
| `GMO_ENDPOINT`                            | true     |                | GMO API endpoint                            |
| `GMO_SITE_ID`                             | true     |                | GMO SiteID                                  |
| `GMO_SITE_PASS`                           | true     |                | GMO SitePass                                |
| `PECORINO_ENDPOINT`                       | true     |                | Pecorino endpoint                           |
| `PECORINO_AUTHORIZE_SERVER_DOMAIN`        | true     |                | Pecorino authorize server domain            |
| `PECORINO_CLIENT_ID`                      | true     |                | Pecorino client id                          |
| `PECORINO_CLIENT_SECRET`                  | true     |                | Pecorino client secret                      |
| `CHEVRE_ENDPOINT`                         | true     |                | Chevre endpoint                             |
| `CHEVRE_AUTHORIZE_SERVER_DOMAIN`          | true     |                | Chevre authorize server domain              |
| `CHEVRE_CLIENT_ID`                        | true     |                | Chevre client id                            |
| `CHEVRE_CLIENT_SECRET`                    | true     |                | Chevre client secret                        |
| `COA_ENDPOINT`                            | true     |                | COA endpoint                                |
| `COA_REFRESH_TOKEN`                       | true     |                | COA refresh token                           |
| `TRANSACTION_RATE_LIMIT_UNIT_IN_SECONDS`  | true     |                | Transaction rate limit unit                 |
| `TRANSACTION_RATE_LIMIT_THRESHOLD`        | true     |                | Transaction rate limit threshold            |
| `RESOURCE_SERVER_IDENTIFIER`              | true     |                | Resource server identifier                  |
| `TOKEN_ISSUERS`                           | true     |                | Token issuers(Comma-separated)              |
| `WAITER_DISABLED`                         | false    | 1 or 0         | WAITER Disable Flag                         |
| `WAITER_SECRET`                           | true     |                | WAITER Pasport Token Secret                 |
| `WAITER_PASSPORT_ISSUER`                  | true     |                | WAITER Pasport Issuer                       |
| `ORDER_INQUIRY_ENDPOINT`                  | true     |                | Order inquiry endpoint                      |
| `BASIC_AUTH_NAME`                         | false    |                | Basic authentication user name              |
| `BASIC_AUTH_PASS`                         | false    |                | Basic authentication user password          |
| `AWS_ACCESS_KEY_ID`                       | true     |                | AWS access key                              |
| `AWS_SECRET_ACCESS_KEY`                   | true     |                | AWS secret access key                       |
| `COGNITO_USER_POOL_ID`                    | true     |                | Cognito user pool ID                        |
| `CODE_EXPIRES_IN_SECONDS`                 | true     |                | 所有権コード期限                            |
| `SENDGRID_API_KEY`                        | true     |                | SendGrid APIキー                            |
| `MVTK_RESERVE_ENDPOINT`                   | true     |                | ムビチケ着券APIエンドポイント               |
| `MVTK_RESERVE_AUTHORIZE_SERVER_DOMAIN`    | true     |                | ムビチケ着券API認可サーバードメイン         |
| `MVTK_RESERVE_CLIENT_ID`                  | true     |                | ムビチケ着券APIクライアントID               |
| `MVTK_RESERVE_CLIENT_SECRET`              | true     |                | ムビチケ着券APIクライアントシークレット     |
| `IMPORT_EVENTS_INTERVAL_IN_MINUTES`       | true     |                | イベントインポートインターバル              |
| `LENGTH_IMPORT_SCREENING_EVENTS_IN_WEEKS` | true     |                | イベントインポート期間                      |
| `JOBS_STOPPED`                            | true     | 1 or 0         | 非同期ジョブ停止フラグ                      |
| `USE_OLD_PASSPORT_VALIDATOR`              | false    | 1 or 0         | 旧許可証バリデータ使用フラグ                |
| `USE_IN_MEMORY_OFFER_REPO`                | false    | 1 or 0         | インメモリオファーリポジトリ使用フラグ      |
| `USE_REDIS_EVENT_ITEM_AVAILABILITY_REPO`  | false    | 1 or 0         | イベント在庫状況Redisリポジトリ使用フラグ   |
| `OWNERSHIP_INFO_UUID_DISABLED`            | false    | 1 or 0         | 所有権UUID使用無効化フラグ                  |
| `CUSTOMER_TELEPHONE_JP_FORMAT_ACCEPTED`   | false    | 1 or 0         | 日本フォーマットの電話番号許容フラグ        |
| `USE_USERNAME_AS_GMO_MEMBER_ID`           | false    | 1 or 0         | GMO会員IDにユーザーネームを使用するかどうか |

## License

ISC
