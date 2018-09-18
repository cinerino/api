# Cinerino API Application

[![CircleCI](https://circleci.com/gh/cinerino/api.svg?style=svg)](https://circleci.com/gh/cinerino/api)

## Table of contents

* [Usage](#usage)
* [License](#license)

## Usage

### Environment variables

| Name                                     | Required | Value           | Purpose                            |
|------------------------------------------|----------|-----------------|------------------------------------|
| `DEBUG`                                  | false    | cinerino-jobs:* | Debug                              |
| `NODE_ENV`                               | true     |                 | Environment name                   |
| `MONGOLAB_URI`                           | true     |                 | MongoDB connection URI             |
| `REDIS_HOST`                             | true     |                 | Redis Cache host                   |
| `REDIS_PORT`                             | true     |                 | Redis Cache port                   |
| `REDIS_KEY`                              | true     |                 | Redis Cache key                    |
| `GMO_ENDPOINT`                           | true     |                 | GMO API endpoint                   |
| `GMO_SITE_ID`                            | true     |                 | GMO SiteID                         |
| `GMO_SITE_PASS`                          | true     |                 | GMO SitePass                       |
| `PECORINO_ENDPOINT`                      | true     |                 | Pecorino endpoint                  |
| `PECORINO_AUTHORIZE_SERVER_DOMAIN`       | true     |                 | Pecorino authorize server domain   |
| `PECORINO_CLIENT_ID`                     | true     |                 | Pecorino client id                 |
| `PECORINO_CLIENT_SECRET`                 | true     |                 | Pecorino client secret             |
| `CHEVRE_ENDPOINT`                        | true     |                 | Chevre endpoint                    |
| `CHEVRE_AUTHORIZE_SERVER_DOMAIN`         | true     |                 | Chevre authorize server domain     |
| `CHEVRE_CLIENT_ID`                       | true     |                 | Chevre client id                   |
| `CHEVRE_CLIENT_SECRET`                   | true     |                 | Chevre client secret               |
| `TRANSACTION_RATE_LIMIT_UNIT_IN_SECONDS` | true     |                 | Transaction rate limit unit        |
| `TRANSACTION_RATE_LIMIT_THRESHOLD`       | true     |                 | Transaction rate limit threshold   |
| `RESOURCE_SERVER_IDENTIFIER`             | true     |                 | Resource server identifier         |
| `TOKEN_ISSUERS`                          | true     |                 | Token issuers(Comma-separated)     |
| `WAITER_DISABLED`                        | true     | 1 or 0          | WAITER Disable Flag                |
| `WAITER_SECRET`                          | true     |                 | WAITER Pasport Token Secret        |
| `WAITER_PASSPORT_ISSUER`                 | true     |                 | WAITER Pasport Issuer              |
| `ORDER_INQUIRY_ENDPOINT`                 | true     |                 | Order inquiry endpoint             |
| `BASIC_AUTH_NAME`                        | false    |                 | Basic authentication user name     |
| `BASIC_AUTH_PASS`                        | false    |                 | Basic authentication user password |
| `AWS_ACCESS_KEY_ID`                      | true     |                 | AWS access key                     |
| `AWS_SECRET_ACCESS_KEY`                  | true     |                 | AWS secret access key              |
| `COGNITO_USER_POOL_ID`                   | true     |                 | Cognito user pool ID               |

## License

ISC
