# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/).

## Unreleased

### Added

- 注文番号と電話番号での照会サービスを追加

### Changed

- req.agent.memberOfから不要な情報を削除
- 返金後の注文通知アクション指定を廃止
- プロジェクトに返品手数料設定を追加
- 注文取引確定時の注文通知指定を削除
- 返品取引確定時の注文通知指定を削除
- グローバル設定に取引通知設定を追加
- プロジェクトの返金時設定を削除
- 注文配送を管理者以外にも実行できるように調整
- 個人情報での注文検索処理を最適化
- オファーのアドオンに対しても利用可能アプリケーション設定を適用
- 注文ステータス変更の冪等性担保
- イベントの座席検索レスポンスを最適化
- 注文取引のカスタマー情報をobject.customerにセットするように調整
- order.customerをtransaction.object.customerから生成するように調整
- メンバーパーミッション読み取り権限を持つクライアントのみログインユーザーとしてパーミッションを検索するように調整

### Deprecated

### Removed

- ページングなしのイベント座席検索を削除
- 予約使用アクション取消を削除

### Fixed

### Security

## v5.47.0 - 2021-03-12

### Added

- グローバル設定に注文変更時通知設定を追加
- USE_FACE_TO_FACE_PAYMENT設定を追加
- RATE_LIMIT_THRESHOLD_GET設定を追加
- USE_PROJECTLESS_ROUTER設定を追加
- 注文にbrokerを追加

### Changed

- 許可スコープから'pos'を削除
- リクエストにisPOSをセットするように調整
- 注文取引でcustomerを指定できるように調整
- Chevre返金時にpurposeを返品アクションに指定するように調整
- Chevreエラーハンドリング強化
- 返金後メール送信を指定されなければ実行しないように調整

### Removed

- 非推奨エンドポイントを削除
- Chevreを使用しない汎用決済サービスを削除

## v5.46.3 - 2021-02-12

### Changed

- 注文から予約への決済方法の連携に関して、決済方法区分コードがOthersの場合、名称を取り込むように調整

## v5.46.2 - 2021-01-27

### Changed

- MAXIMUM_REQUEST_BODY_SIZE設定を追加

## v5.46.1 - 2021-01-26

### Changed

- Chevre予約の追加特性からpaymentSeatIndex,csvCode,transactionを削除

## v5.46.0 - 2021-01-22

### Added

- 注文トークンによる口座開設サービスを追加
- 予約アクション取消サービスを追加

### Changed

- 通貨転送取引を再実装
- 注文取引に対する特典口座番号を発行できるように調整
- 全プロジェクトに許可されたアプリケーションクライアント管理を追加
- 注文作成後の通知に注文トークンを付加
- Chevre決済中止処理のエラーハンドリングを調整
- 予約使用レスポンスにアクションIDを含めることができるように調整
- 予約に対する使用アクションをChevreで実装
- 予約使用時にagent.identifierを指定できるように調整

### Removed

- 所有権に対するトークン検証アクション検索を削除

## v5.45.0 - 2020-12-17

### Changed

- 所有権コレクションにユニークインデックスを追加
- インボイスコレクションにユニークインデックスを追加
- upsertを使用したクエリを実行した際の重複エラーハンドリングを追加
- オファーカテゴリーについて、オファーの追加特性参照を廃止(ttts対応)
- プロジェクトのonOrderStatusChangedを編集できるように調整

## v5.44.1 - 2020-12-13

### Changed

- IAMメンバー追加時に名称を指定できるように調整

## v5.44.0 - 2020-12-11

### Changed

- ポイント特典付与の際に、Pecorino取引に対して識別子を指定するように調整
- USE_LEGACY_AUTHORIZE_ORDER設定を削除
- 注文番号の拡張性強化
- 注文取引に対して任意のタイミングで注文番号を発行できるように調整
- $setOnInsertを使用したクエリに対して{new: true}をセット

### Removed

- トークンでの予約照会サービス(非推奨)を削除

## v5.43.2 - 2020-12-07

### Changed

- メンバーシップ注文時の初回登録かどうかをアプリケーション側に指定させるように変更

## v5.43.1 - 2020-12-06

### Changed

- タスクの実行間隔を調整

## v5.43.0 - 2020-12-04

### Added

- USE_LEGACY_AUTHORIZE_ORDER設定を追加

### Changed

- プロジェクト設定からcodeExpiresInSecondsを削除
- 注文取引開始パラメータからseller.typeOfを削除
- update @chevre/factory
- 決済サービス検索結果からサービス認証情報を隠蔽
- USE_MULTI_ORDERS_BY_CONFIRMATION_NUMBER設定を削除
- 注文に最低限の勘定科目情報を追加
- 予約取引中止前に取引の存在確認処理を追加
- サービス登録取引中止前に取引の存在確認処理を追加

## v5.42.0 - 2020-11-26

### Changed

- Account決済ルーターをPaymentCard決済ルーターに統合
- プロダクトオファー承認時のアクセスコード指定を4桁の数字で固定
- 所有権検索条件拡張
- ペイメントカードに対する所有権検索時に、ペイメントカードタイプを動的に検索するように調整
- sskts専用メンバーシップ登録時に、agent.additionalPropertyを指定できるように調整
- ssktsポイント入金のレート制限を調整
- 返品ポリシーのmerchantReturnDaysを注文返品取引に適用

## v5.41.0 - 2020-11-17

### Changed

- AccountプロダクトタイプをPaymentCardに統合
- 口座注文時に、口座にアクセスコードを設定

## v5.40.0 - 2020-11-13

### Changed

- ヘルスチェックを調整
- 注文取引確定時の確認番号カスタム指定を削除
- update @chevre/api-nodejs-client
- MovieTicket系統決済の場合、決済承認前に注文の確認番号を発行するように調整
- アクション検索条件拡張
- ペイメントカード決済処理をChevre決済取引に統合
- 確認番号での注文照会レスポンスをArrayに変更

## v5.39.3 - 2020-11-06

### Changed

- update @chevre/api-nodejs-client

## v5.39.2 - 2020-11-06

### Changed

- MoneyTransferアクションのamountがMonetaryAmount型の場合に対応

## v5.39.1 - 2020-11-06

### Changed

- update @pecorino/api-nodejs-client
- update @cinerino/factory

## v5.39.0 - 2020-11-05

### Changed

- update @chevre/api-nodejs-client
- update @motionpicture/gmo-service
- update @pecorino/api-nodejs-client
- update mongoose

### Removed

- 管理者としての口座開設サービスを削除

## v5.38.0 - 2020-11-04

### Added

- 予約使用アクション検索を追加

### Changed

- USE_CHECK_TOKEN_ACTIONS設定を削除
- 所有権トークンでの予約使用時にトークンチェックアクションを生成しないように調整
- 非管理者による注文作成時に、purpose.idの指定を確認するように調整
- 外部決済サービス認証情報をプロダクト検索から取得するように調整
- プロジェクトからsubscriptionを削除
- ownershipInfos.actions.checkToken.readスコープをreservations.readに変更

### Deprecated

- 所有権に対するトークン検証アクション検索を非推奨化

### Removed

- 予約発券を削除
- 予約入場を削除

## v5.37.0 - 2020-10-26

### Added

- カテゴリーコード検索を追加
- 注文承認サービスを追加
- トークンルーターを追加
- 予約使用サービスを追加
- CODE_EXPIRES_IN_SECONDS_DEFAULT設定を追加
- CODE_EXPIRES_IN_SECONDS_MAXIMUM設定を追加

### Changed

- update @cinerino/domain
- 注文に対するコード発行時に、複数コード発行を1アクションで実行するように調整
- アクション検索条件拡張
- 取引期限監視調整
- 予約入場時に予約使用アクションを生成するように調整
- トークンでの予約照会のレスポンスを削除
- 所有権トークンチェックアクション検索を、予約使用アクション検索に変更
- 確認番号での注文照会パラメータを拡張(注文番号との組み合わせを追加)
- COAでの予約処理において、ムビチケあるいはMGを利用した予約かどうかの判定を、mvtkAppPriceからmvtkNumに変更
- 注文作成をcustomerロールでも実行可能に拡張

## v5.36.3 - 2020-10-15

### Changed

- order.identifier.paymentNoにconfirmationNumberを設定

## v5.36.2 - 2020-10-14

### Changed

- ttts専用paymentNoをorder.identifierから削除

## v5.36.1 - 2020-10-12

### Changed

- 許可証の有効条件から販売者identifierを削除
- update @cinerino/domain

## v5.36.0 - 2020-10-12

### Changed

- 販売者検索においてlocation.branchCodesをadditionalPropertyに自動変換するように調整
- 販売者検索においてlocation属性を自動保管するように調整(ssktsへの互換性維持対応として)
- 許可証の有効条件に販売者の追加特性を採用

## v5.35.1 - 2020-10-10

### Changed

- 販売者の決済情報が不要に露出しないように調整

## v5.35.0 - 2020-10-08

### Added

- イベント更新サービスに、更新後アクションの指定を実装

## v5.34.0 - 2020-10-06

### Changed

- update @cinerino/domain
- Chevre決済サービスを口座決済に対応
- 所有権のownedByを最適化
- 所有権のacquiredFromを最適化
- 注文を最適化
- 注文アイテムとしてのCOA予約生成処理を仮予約時に移動
- 注文アイテムとしてのCOA予約を最適化
- 予約オファー承認アクションを最適化

## v5.33.0 - 2020-09-24

### Changed

- update @chevre/api-nodejs-client
- update @pecorino/api-nodejs-client

## v5.32.0 - 2020-09-23

### Changed

- update @motionpicture/coa-service
- COA予約承認処理をMGチケットに対応
- 口座決済返金時のtoocationのタイプをAccountに変更

## v5.31.0 - 2020-09-18

### Added

- プロジェクトにuseMyCreditCards設定を追加

### Changed

- update @chevre/api-nodejs-client
- update @cinerino/factory
- update @pecorino/api-nodejs-client
- ポイント口座での決済取引開始時のfromLocationのタイプをAccountに変更
- 販売者検索からX-Total-Countを削除
- メンバーシップ注文取引のcustomerを最適化
- メンバーシップ注文タスクのagentを最適化
- メンバーシップ注文タスクのagentの追加特性を注文取引に反映するように調整

## v5.30.0 - 2020-09-16

### Changed

- SendGrid設定に関して、プロセスレベルでの設定とプロジェクトレベルでの設定を両方有効化
- 所有権インターフェースの汎用性拡張
- Chevre転送取引へのignorePaymentCard指定を削除
- CancelSeatReservationタスクをVoidReserveタスクに変更

### Removed

- USE_CHEVRE_REFUND_CREDIT_CARD設定を削除
- USE_CHEVRE_PAY_CREDIT_CARD設定を削除
- USE_CHEVRE_PAY_MOVIE_TICKET設定を削除

## v5.29.0 - 2020-09-10

### Changed

- ムビチケ認証処理をChevreへ移行
- 旧メンバーシップ注文タスク(registerProgramMembership)を停止
- @chevre/factoryと重複するインターフェースを最適化

## v5.28.0 - 2020-09-08

### Added

- USE_CHEVRE_REFUND_CREDIT_CARD設定を追加
- USE_CHEVRE_PAY_CREDIT_CARD設定を追加
- USE_CHEVRE_PAY_MOVIE_TICKET設定を追加

### Changed

- 決済承認処理をChevre決済に対応
- 決済処理をChevre決済に対応
- 決済中止処理をChevre決済に対応
- Chevre返金処理をクレジットカード以外の決済方法に対応
- オファーの適用ムビチケ条件の決済方法として、appliesToMovieTicket.serviceOutput.typeOfを参照するように変更
- 注文取引確定時のムビチケ系統決済に対する検証処理を、利用可能なムビチケ系統決済方法タイプに対して動的に実行するように調整
- プロジェクトごとの管理者ユーザープール管理を統合

## v5.27.0 - 2020-08-28

### Added

- 汎用決済中止タスクを追加
- 汎用返金タスクを追加

### Changed

- 口座決済タスクを汎用決済タスクに変更
- ペイメントカード決済タスクを汎用決済タスクに変更
- 注文後の個別決済アクションを汎用決済アクションに変更
- 注文返品後の個別返金アクションを汎用返金アクションに変更
- 決済アクションを最適化
- 注文後の決済アクション作成処理を汎用化
- 注文返品後の返金アクション作成処理を汎用化
- 決済方法タイプに依存するジェネリック型を削除
- プロジェクト設定からGMO情報を削除
- 販売者の対応決済方法インターフェースの汎用性拡張

### Removed

- 個別決済タスクを削除
- 個別決済中止タスクを削除
- 個別返金タスクを削除

## v5.26.0 - 2020-08-21

### Changed

- 注文取引確定時の決済承認リストが静的な決済方法管理に依存しないように調整
- 注文取引確定時の決済承認リストが承認アクションのobject.typeOfに依存しないように調整
- アクションコレクションインデックス調整
- 決済承認アクションのinstrumentを決済サービスとして定義
- 決済承認アクションのobject.typeOfを'Payment'に統一
- 決済承認アクションのinstrumentを決済アクションに連携
- 認可コードフローのクライアントが、アプリケーションクライアントとしてプロジェクトを検索できるように調整
- クレジットカード決済タスクを汎用決済タスクに変更
- ムビチケ決済タスクを汎用決済タスクに変更

### Removed

- メンバーシッププログラム検索を削除

## v5.25.0 - 2020-08-19

### Changed

- 決済承認アクションにresult.typeOfを追加

## v5.24.0 - 2020-08-19

### Changed

- 決済承認アクションにobject.paymentMethodを追加

## v5.23.0 - 2020-08-18

### Changed

- Waiter許可証バリデーションに販売者:*のパターンを追加

## v5.22.0 - 2020-08-11

### Changed

- メンバーシップサービス登録エンドポイントをDEFAULT_MEMBERSHIP_SERVICE_IDに対してのみ受け入れるように調整

## v5.21.2 - 2020-08-08

### Changed

- 注文取引開始時の所有メンバーシップ検索を削除

## v5.21.1 - 2020-08-04

### Changed

- update @cinerino/domain

## v5.21.0 - 2020-08-03

### Added

- イベント部分更新エンドポイントを追加

## v5.20.0 - 2020-07-19

### Changed

- GMOオーダーIDをChevre取引番号に変更

### Removed

- USE_SEPARATE_MOVIE_TICKET_PAYMENT設定を削除

## v5.19.0 - 2020-07-17

### Added

- USE_SEPARATE_MOVIE_TICKET_PAYMENT設定を追加

### Changed

- ttts専用paymentNoをconfirmationNumberに統合

## v5.18.0 - 2020-07-15

### Changed

- update @cinerino/domain
- プロジェクト設定からmvtkReserveを削除
- Eメール送信時にSendGridへユニーク引数を追加
- ムビチケ決済処理を細分化
- COA仮予約時のエラーハンドリングを強化
- 販売者リポジトリをChevreへ移行
- ssktsムビチケ決済承認処理を本家に統合

## v5.17.2 - 2020-07-10

### Changed

- ムビチケサービスエンドポイント設定をChevreへ移行

## v5.17.1 - 2020-07-10

### Changed

- ムビチケサービスエンドポイント設定をChevreへ移行

## v5.17.0 - 2020-07-10

### Changed

- update @cinerino/domain
- プロジェクトのuseReservationNumberAsConfirmationNumber設定を削除
- オファーと価格仕様のappliesToMovieTicketType→appliesToMovieTicket対応
- ムビチケ系統決済処理をMGTicketに対応
- ムビチケサービスエンドポイント設定をChevreへ移行

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
