# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/).

## Unreleased

### Added

### Changed

### Deprecated

### Removed

### Fixed

### Security

## v1.6.1 - 2020-01-15

### Fixed

- プロジェクトメンバー取得のレスポンスを修正

## v1.6.0 - 2020-01-15

### Added

- アプリケーション追加エンドポイントを追加
- IAMメンバー追加エンドポイントを追加
- IAMメンバー削除エンドポイントを追加

### Changed

- IAMロールリポジトリを追加
- アプリケーションクライアントもIAMメンバーとして管理するように調整
- Mongoのcursorを使用するアクションに関して、DBコネクションを独自に生成するように変更
- 以下権限を追加
    - `actions.printTicket.*`
    - `people.me.*`
    - `iam.members.read`
    - `iam.roles.read`
    - `userPools.read`
    - `userPools.clients.read`

### Removed

- `CLIENTS_AS_CUSTOMER`設定を削除

## v1.5.0 - 2020-01-10

### Changed

- 以下権限を追加
    - `events.*`
    - `events.read`
    - `orders.read`
    - `orders.findByConfirmationNumber`

## v1.4.0 - 2020-01-09

### Added

- プロジェクトメンバーの簡易な権限管理を追加
- プロジェクトメンバー検索を追加
- IAMロール検索を追加
- プロジェクト設定取得エンドポイントを追加

### Changed

- プロジェクトユーザーロールの使用可能サービスの許可スコープに`user`を追加
- 以下権限を追加
    - `accounts.*`
    - `accounts.read`
    - `actions.*`
    - `actions.read`
    - `applications.*`
    - `applications.read`
    - `authorizations.*`
    - `authorizations.read`
    - `creativeWorks.read`
    - `events.read-only`
    - `iam.members.me.read`
    - `invoices.*`
    - `invoices.read`
    - `orders.*`
    - `orders.read`
    - `orders.read-only`
    - `organizations.read-only`
    - `paymentMethods.*`
    - `paymentMethods.read`
    - `people.*`
    - `people.read`
    - `programMemberships.*`
    - `programMemberships.read`
    - `reservations.*`
    - `reservations.findByToken`
    - `sellers.read`
    - `tokens`
    - `transactions.*`
    - `transactions.read`
    - `transactions`
    - `tasks.*`
    - `tasks.read`
- プロジェクトメンバーでないリクエストユーザーに`customer`ロールを与えるように調整

### Deprecated

### Removed

- 追加許可スコープ設定を削除
- `CLIENTS_AS_ADMIN`設定を削除

## v1.3.0 - 2020-01-01

### Added

- 組織タイプにProjectを追加
- プロジェクトメンバーリポジトリを追加

### Changed

- ユーザーが閲覧権限を持つプロジェクトのみ検索できるように制限

## v1.2.0 - 2019-12-31

### Changed

- プロジェクト未指定でのプロジェクト検索を可能に変更

## v1.1.1 - 2019-12-31

### Fixed

- 注文検索のデフォルト注文日時条件が検索可能期間内に設定されないバグ対応
- 予約検索のデフォルト予約日時条件が検索可能期間内に設定されないバグ対応

## v1.1.0 - 2019-12-28

### Added

- 組織ルーターを追加

## v1.0.0 - 2019-12-26

### Added

- イベントサービスを追加
- 取引サービスを追加
- 口座サービスを追加
- 予約サービスを追加
- 所有権サービスを追加
- 予約サービスを追加
- 販売者サービスを追加
- インボイスサービスを追加
- オファーサービスを追加
- アクションサービスを追加
- プロジェクトサービスを追加
- 承認サービスを追加
- 決済サービスを追加
