# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/).

## Unreleased

### Added

### Changed

- update @cinerino/domain
- プロジェクトのuseReservationNumberAsConfirmationNumber設定を削除
- オファーと価格仕様のappliesToMovieTicketType→appliesToMovieTicket対応
- ムビチケ系統決済処理をMGTicketに対応
- ムビチケサービスエンドポイント設定をChevreへ移行

### Deprecated

### Removed

### Fixed

### Security

## v5.16.1 - 2020-07-07

### Added

- プロジェクト更新時に不要な属性を削除するように調整

## v5.16.0 - 2020-07-07

### Changed

- Chevreエンドポイントを環境変数として設定するように変更
- Pecorinoエンドポイントを環境変数として設定するように変更

## v5.15.5 - 2020-07-06

### Changed

- ポイントインセンティブ承認からnotesの指定を復元

## v5.15.4 - 2020-07-06

### Changed

- ポイントインセンティブ承認からnotesの指定を削除

## v5.15.3 - 2020-07-04

### Changed

- プロダクトオファー検索に販売期間の検証を追加

## v5.15.2 - 2020-07-04

### Changed

- 口座注文後に取引タスクを非同期で実行するように調整

## v5.15.1 - 2020-07-04

### Changed

- メンバーシップと口座オファー検索時に販売者とアプリケーションを検証するように調整

## v5.15.0 - 2020-07-03

### Added

- プロダクトオファー承認時に利用アプリケーションの検証を追加
- プロダクトオファー承認時に販売者の検証を追加
- プロダクトオファー検索に販売者の検証を追加

### Changed

- update @cinerino/domain
- 口座注文進行時に、プロダクトオファーから販売者を自動選択するように調整
- 口座開設レスポンスを口座注文取引結果に変更

## v5.14.0 - 2020-06-30

### Changed

- プロダクトオファー検索に利用アプリケーション条件、有効期間条件を適用

## v5.13.0 - 2020-06-29

### Changed

- update express-validator
- メンバーシップ注文処理中のクレジットカード決済に関して、クライアントエラーであればリトライしないように調整

## v5.12.0 - 2020-06-28

### Changed

- 口座開設を口座注文処理へ完全移行
- 所有権インターフェース汎用性拡張

## v5.11.1 - 2020-06-27

### Removed

- PROJECT_ID設定を削除

## v5.11.0 - 2020-06-27

### Added

- サービス登録中止タスクを追加

## v5.10.0 - 2020-06-27

### Added

- サービス登録中止タスクを追加

## v5.9.0 - 2020-06-27

### Changed

- メンバーシップと口座注文時に確認番号を発行するように調整

## v5.8.1 - 2020-06-25

### Added

- 所有権検索条件拡張
- COA予約にbookingTime属性を追加

### Changed

- update @cinerino/domain

## v5.8.0 - 2020-06-25

### Added

- プロダクトタイプにAccountを追加

### Changed

- 口座開設を口座注文としても処理できるように調整

## v5.7.0 - 2020-06-24

### Added

- アクション検索条件拡張

## v5.6.0 - 2020-06-24

### Changed

- 口座番号をChevreで発行するように調整

## v5.5.2 - 2020-06-24

### Changed

- プロダクト識別子をChevreで発行するように調整

## v5.5.1 - 2020-06-23

### Changed

- update @cinerino/domain

## v5.5.0 - 2020-06-23

### Added

- プロダクトオファー承認サービスを追加

### Changed

- プロダクトオファー承認にポイント特典を指定できるように調整
- メンバーシップ登録を汎用的なサービス登録へ移行
- 会員削除後のメンバーシップ所有権期限変更処理を削除
- 注文検索条件拡張

## v5.4.0 - 2020-06-21

### Added

- プロダクトオファー承認取消処理を追加

## v5.3.0 - 2020-06-21

### Changed

- プロダクトオファー承認に対してサービス登録排他ロック処理を追加

## v5.2.0 - 2020-06-21

### Added

- USE_AUTHORIZE_PRODUCT_OFFER設定を追加

## v5.1.0 - 2020-06-20

### Changed

- update @cinerino/domain
- メンバーシップ注文配送処理をプロダクト注文配送処理に統合

## v5.0.0 - 2020-06-19

### Added

- USE_MULTI_ORDERS_BY_CONFIRMATION_NUMBER環境変数を追加

### Changed

- メンバーシップ登録時のポイント特典をChevreで処理するように調整
- メンバーシップ注文処理をメンバーシップサービスから分離
- メンバーシップ登録ロックホルダーを注文取引IDに変更
- メンバーシップ登録ロックのタイミングをサービス登録取引開始前へ移行
- メンバーシップ注文失敗時に、メンバーシップオファー承認を明示的に取り消すように調整
- 注文アイテムを複数のプロダクト対応に対応

### Removed

- 非推奨エンドポイントを削除

## v4.3.0 - 2020-06-15

### Changed

- メンバーシップの注文取引をChevreサービス登録取引に連携

## v4.2.1 - 2020-06-10

### Changed

- メンバーシップサービスのserviceOutputがarrayでない場合に対応

## v4.2.0 - 2020-06-02

### Added

- 注文アイテムに決済カードを追加
- 予約発券を追加
- 予約入場を追加
- 1トランザクションでの予約取消取引処理を追加
- プロジェクトに返金通知設定を追加

### Changed

- 金額オファー承認をChevre通貨転送取引連携へ変更
- Pecorino取引に対して取引番号を指定するように調整
- ポイント決済を出金取引へ変更
- ポイント付与処理と管理者入金処理をChevre通貨転送取引へ変更
- 口座決済処理をChevre通貨転送取引へ変更
- Chevre予約取引に対して取引番号を事前に発行するように調整
- 予約取引を取引番号でステータス変更するように調整
- 注文返品取引オブジェクトを最適化
- 予約取消タスクを予約番号で処理するように変更
- 予約取消タスクを注文データから作成するように調整
- 返金アクションのオブジェクトを決済方法に変更
- 返品取引を複数注文に対応

## v4.1.0 - 2020-05-04

### Added

- イベントオファー承認結果にamountを追加
- 注文にnameを追加
- COA予約承認にpriceSpecificationを追加
- ssktsムビチケ決済承認時に指定座席番号をムビチケに追加
- 決済方法にMGTicketを追加
- 決済方法にPrepaidCardを追加
- プリペイドカードインターフェースを追加
- プリペイドカード決済インターフェースを追加
- プリペイドカード返金インターフェースを追加
- プリペイドカード作成を追加
- プリペイドカード検索を追加

### Changed

- イベントオファー承認結果のpointをamountへ移行
- ムビチケディスカウントサービスを前売券決済サービスとして再定義
- 注文取引確定時の口座バリデーションを口座タイプ管理に対応

### Removed

- プロジェクトのvalidateMovieTicket設定を削除

## v4.0.0 - 2020-04-26

### Added

- 取引確定後アクションパラメータにインセンティブ付与を追加

### Changed

- 会員サービスのオファー属性をChevreへ移行
- 会員サービスリポジトリをChevreへ移行
- InMemoryオファーリポジトリをChevreへ移行
- 注文取引開始時に所有メンバーシップを実験的に記録
- ポイントインセンティブ承認時に口座取引を開始しないように調整
- インセンティブ付与承認アクションを、取引確定後アクションパラメータへ移行

### Removed

- ポイントインセンティブ承認アクション取消タスクを削除
- 口座タイプをChevre管理へ移行

## v3.6.0 - 2020-04-26

### Changed

- 会員サービスの特典ポイント属性をserviceOutputの中へ移行

## v3.5.0 - 2020-04-25

### Changed

- update @chevre/factory

## v3.4.0 - 2020-04-25

### Changed

- 会員プログラムの価格仕様参照をeligibleDurationからpriceSpecificationへ変更

## v3.3.0 - 2020-04-25

### Changed

- 会員プログラムの価格仕様参照をeligibleDurationからpriceSpecificationへ変更

## v3.2.0 - 2020-04-25

### Changed

- 会員プログラムの価格仕様参照をeligibleDurationからpriceSpecificationへ変更

## v3.1.0 - 2020-04-24

### Changed

- 会員プログラムインターフェースを最適化

## v3.0.0 - 2020-04-24

### Changed

- 所有権対象のメンバーシップの属性を最適化
- ssktsにおける会員プログラムの特典管理を削除
- 所有権対象のメンバーシップにmembershipFor属性を追加
- メンバーシップインターフェースをメンバーシップとプログラムに分離
- 所有権コレクションのインデックス調整

## v2.1.2 - 2020-04-23

### Changed

- ウェブフック通知のエラーハンドリング調整

## v2.1.1 - 2020-04-23

### Changed

- 会員登録数カウントサービスの期間条件について、作品日時ではなく所有期間を参照するように変更

## v2.1.0 - 2020-04-22

### Changed

- 会員プログラム注文プロセスにおいて最新の会員プログラム情報を取得するように変更

## v2.0.2 - 2020-04-22

### Changed

- IAMサービス調整

## v2.0.1 - 2020-04-21

### Changed

- イベント検索の不要なコードを削除

## v2.0.0 - 2020-04-21

### Added

- 予約ダウンロードを追加
- 場所サービスを追加
- 注文レポート作成タスクを実験的に追加
- 販売者に返品ポリシー属性を追加
- イベントの座席オファーのページング検索機能を追加
- プロジェクト作成を追加
- プロジェクト更新を追加

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
- 返品取引開始時に返品ポリシー確認を追加

### Removed

- 場所(オンラインとストア)インターフェースを削除
- プロジェクトのイベントリポジトリ使用設定を廃止
- イベントインポートタスクを削除
- イベントキャパシティ更新タスクを削除

### Fixed

- COAのXMLスケジュール抽出を、screener.timeが配列でない場合に対応

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
