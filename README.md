# Cinerino API Application

[![CircleCI](https://circleci.com/gh/cinerino/api.svg?style=svg)](https://circleci.com/gh/cinerino/api)

## Table of contents

* [Usage](#usage)
* [License](#license)

## Usage

### Environment variables

| Name                                     | Required | Value          | Purpose                                 |
| ---------------------------------------- | -------- | -------------- | --------------------------------------- |
| `AWS_ACCESS_KEY_ID`                      | true     |                | AWS access key                          |
| `AWS_SECRET_ACCESS_KEY`                  | true     |                | AWS secret access key                   |
| `BASIC_AUTH_NAME`                        | false    |                | Basic authentication user name          |
| `BASIC_AUTH_PASS`                        | false    |                | Basic authentication user password      |
| `CHEVRE_AUTHORIZE_SERVER_DOMAIN`         | true     |                | Chevre credentials                      |
| `CHEVRE_CLIENT_ID`                       | true     |                | Chevre credentials                      |
| `CHEVRE_CLIENT_SECRET`                   | true     |                | Chevre credentials                      |
| `CHEVRE_ENDPOINT`                        | true     |                | Chevre credentials                      |
| `COA_ENDPOINT`                           | true     |                | COA endpoint                            |
| `COA_REFRESH_TOKEN`                      | true     |                | COA refresh token                       |
| `DEBUG`                                  | false    | cinerino-api:* | Debug                                   |
| `DEBUG_SINGLETON_PROCESS`                | false    | 1 or 0         | Singleton Process Debug Flag            |
| `IMPORT_EVENTS_PER_WEEKS`                | true     |                | イベントインポート処理単位期間          |
| `JOBS_STOPPED`                           | true     | 1 or 0         | 非同期ジョブ停止フラグ                  |
| `MONGOLAB_URI`                           | true     |                | MongoDB connection URI                  |
| `MONGO_AUTO_INDEX_DISABLED`              | false    | 1 or 0         | MongoDB auto index flag                 |
| `REDIS_HOST`                             | true     |                | Redis Cache host                        |
| `REDIS_PORT`                             | true     |                | Redis Cache port                        |
| `REDIS_KEY`                              | true     |                | Redis Cache key                         |
| `REDIS_TLS_SERVERNAME`                   | false    |                | Redis Cache host                        |
| `RESOURCE_SERVER_IDENTIFIER`             | true     |                | Resource server identifier              |
| `TOKEN_ISSUERS`                          | true     |                | Token issuers(Comma-separated)          |
| `TOKEN_ISSUERS_AS_ADMIN`                 | true     |                | Token issuers as admin(Comma-separated) |
| `TRANSACTION_RATE_LIMIT_UNIT_IN_SECONDS` | true     |                | Transaction rate limit unit             |
| `TRANSACTION_RATE_LIMIT_THRESHOLD`       | true     |                | Transaction rate limit threshold        |
| `WAITER_DISABLED`                        | false    | 1 or 0         | WAITER Disable Flag                     |
| `WAITER_SECRET`                          | true     |                | WAITER Pasport Token Secret             |
| `WAITER_PASSPORT_ISSUER`                 | true     |                | WAITER Pasport Issuer                   |

## License

ISC
