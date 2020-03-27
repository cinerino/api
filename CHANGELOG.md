# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/).

## Unreleased

### Added

- 予約ダウンロードを追加
- 場所サービスを追加

### Changed

- 注文検索条件拡張
- 注文CSVレポート拡張
- String型の座席タイプに対応
- Array型の座席タイプに対応
- 座席タイプチャージを予約の価格要素に追加
- 座席順が異なっていてもCOA座席予約の券種を変更できるように調整
- メンバーシップ自動更新時もポイントインセンティブが付与されるように調整
- ttts予約承認を本家予約承認に合わせるように調整
- 予約の余分確保分をsubReservationとして表現するように調整
- デフォルトで確定予約へ連携する値を拡張
- デフォルトで注文識別子にconfirmationNumberとconfirmationPassを追加
- COAリクエストにタイムアウト設定
- タスク実行中止時の通知メッセージ調整
- 予約承認時のエラーハンドリングを調整
- COAイベントインポート時にxmlを参照しないように調整
- MongoDBコネクション監視調整

### Deprecated

### Removed

### Fixed

- COAのXMLスケジュール抽出を、screener.timeが配列でない場合に対応

### Security

## v1.7.0 - 2020-01-24

### Added

- IAMメンバー更新エンドポイントを追加
- 識別子での注文検索を追加

### Changed

- 以下権限を追加
    - `accounts.transactions.deposit.write`
    - `accounts.write`
    - `actions.printTicket.*`
    - `iam.members.write`
    - `iam.members.profile.write`
    - `iam.members.profile.read`
    - `orders.create`
    - `orders.deliver`
    - `ownershipInfos.read`
    - `ownershipInfos.actions.checkToken.read`
    - `payment.any.write`
    - `people.creditCards.delete`
    - `people.delete`
    - `people.profile.update`
    - `reservations.read`
    - `sellers.write`
    - `tasks.create`

- IAMメンバー作成時にロールを複数指定できるように拡張
- 以下権限を削除
    - `customer`
    - `user`

- /people/meリソース検索条件にプロジェクトIDを追加
- ユーザープロフィールを部分的に更新できるように調整
- 旧上映イベントルーターを汎用イベントルーターに統合
- ストリーミング検索にタイムアウトを設定
- COA管理のイベントに対しても、座席オファーと券種オファーを検索できるように調整
- 注文ストリーミング検索の権限をプロジェクト所有者のみに限定
- mongooseのsettersとvirtualsを無効化
- 注文検索条件拡張
- 各リソース検索からX-Total-Countを削除
- 各リソースの正規表現検索についてcase insensitivityを無効化

### Removed

- アプリケーションルーターを削除

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
