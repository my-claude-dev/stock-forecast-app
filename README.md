# 株価予測アプリ

日本株の銘柄を指定すると、過去の株価と将来の株価予測をグラフで表示する、個人専用の PWA です。
Next.js (App Router) を Vercel にデプロイして利用します。

> 本アプリの予測情報は投資助言ではありません。投資判断はご自身の責任で行ってください。

## アクセス制限

このアプリは個人専用のため、`src/proxy.ts` で全ルートに Basic 認証をかけています。
`BASIC_AUTH_USER` / `BASIC_AUTH_PASSWORD` の環境変数が両方とも設定されていない場合、
すべてのリクエストを拒否します(fail closed)。

### ローカル開発

```bash
cp .env.local.example .env.local
# .env.local に BASIC_AUTH_USER / BASIC_AUTH_PASSWORD / JQUANTS_API_KEY を設定
npm run dev
```

[http://localhost:3000](http://localhost:3000) を開き、設定した ID/パスワードでログインします。

### Vercel へのデプロイ(初めての方向け手順)

Vercel はこのアプリを公開するためのホスティングサービスです。GitHub アカウントがあれば
無料(Hobby プラン、クレジットカード不要)で使えます。以下は初回のみ必要な手順です。

1. **Vercel アカウント作成**
   - https://vercel.com/signup を開き、「Continue with GitHub」を選択
   - このリポジトリがある GitHub アカウントでログインし、連携を許可する

2. **プロジェクトのインポート**
   - Vercel のダッシュボードで「Add New...」→「Project」
   - リポジトリ一覧から `my-claude-dev/stock-forecast-app` を選択して「Import」
     (表示されない場合は「Adjust GitHub App Permissions」からアクセスを許可)
   - Framework Preset は自動で「Next.js」になるので変更不要

3. **環境変数の設定(これを忘れると全ページが 401 エラーになります)**
   - 同じ画面の「Environment Variables」で以下を追加
     - `BASIC_AUTH_USER` : 好きなユーザー名
     - `BASIC_AUTH_PASSWORD` : 好きなパスワード(推測されにくいもの)
     - `JQUANTS_API_KEY` : [J-Quants](https://jpx-jquants.com/) のダッシュボード(設定 » APIキー)で発行した API キー
   - 「Deploy」をクリック
   - 既にデプロイ済みのプロジェクトに後から追加する場合は、Settings → Environments →
     Production の「Environment Variables」から追加し、追加後に Redeploy してください
     (環境変数の変更は新しいビルドから反映されます)

4. **公開するブランチの切り替え**
   - 開発中のコードは `main` ではなく `claude/stock-forecast-app-design-kdhyz1` ブランチにあるため、
     最初の Production デプロイはビルドに失敗しますが問題ありません
   - プロジェクトの「Settings」→「Git」→「Production Branch」を
     `claude/stock-forecast-app-design-kdhyz1` に変更して保存
   - 「Deployments」タブの最新デプロイの「...」メニューから「Redeploy」を実行

5. **動作確認**
   - デプロイ完了後に発行される `https://xxxxx.vercel.app` のような URL を開く
   - ブラウザの Basic 認証ダイアログが出るので、手順 3 で設定した ID/パスワードを入力
   - 「株価予測アプリ」というプレースホルダー画面が表示されれば成功

以後はこのブランチに push するたびに自動で再デプロイされます。将来 `main` に機能をマージしたら、
Production Branch を `main` に戻すか、そのまま運用するかを選べます。

## コマンド

```bash
npm run dev     # 開発サーバー起動(webpack)
npm run build   # 本番ビルド(webpack)
npm run start   # 本番サーバー起動
npm run lint    # ESLint
npm run test    # 単体テスト(Vitest)
```

Next.js 16 は既定で Turbopack を使いますが、Service Worker のビルドを担う
`@serwist/next` が現時点で Turbopack 未対応のため、`--webpack` を指定しています。
(Turbopack 対応の `@serwist/turbopack` は執筆時点で experimental のため見送りました)

## PWA 対応

- `src/app/manifest.ts` : Web App Manifest(`/manifest.webmanifest`)
- `src/app/sw.ts` : Service Worker のソース(ビルド時に `public/sw.js` へバンドル、Git管理外)
- `src/app/icon.tsx` / `apple-icon.tsx` / `icons/*` : アプリアイコン(`next/og` の `ImageResponse` でコード生成、画像ファイルは未使用)

Basic 認証の対象から `manifest.webmanifest` / `sw.js` / `icon` 系のパスのみ除外しています。
ブラウザによっては manifest 等を認証情報なしで取得しようとし、保護したままだと
「ホーム画面に追加」が失敗する場合があるためです。アプリ名・アイコン・キャッシュ用の
汎用コードのみが公開され、実際のページ・株価データ・予測結果は引き続き Basic 認証で保護されます
(`src/proxy.ts` 参照)。開発中は `disable: true` にしており、Service Worker は本番ビルドでのみ有効です。

## テスト・CI

`src/lib/` 配下のロジック(銘柄コード検証・予測計算・J-Quants レスポンス解析)は Vitest で単体テスト済みです
(`npm run test`)。外部APIへの実通信はモックしており、ネットワークには依存しません。

`.github/workflows/ci.yml` により、`main` への push と Pull Request で
lint・test・build が自動実行されます。

## 開発状況

- [x] プロジェクト初期セットアップ(雛形作成・Basic 認証・セキュリティヘッダー)
- [x] 銘柄コード入力 → 過去株価・将来予測グラフ表示(`/` → `/stocks/[code]`)
- [x] PWA 対応(manifest・Service Worker・アイコン)
- [x] 単体テスト・CI(GitHub Actions)整備
- [x] Vercel へのデプロイ
- [x] J-Quants API への切り替え(銘柄名検索は今後の課題)

### データソースと予測方式について

日本株の日次終値は [J-Quants API](https://jpx-jquants.com/)(JPX公式)の
`/v2/equities/bars/daily` から取得しています(`src/lib/stocks/jquantsClient.ts`)。
`JQUANTS_API_KEY` 環境変数が必要です。銘柄コードは4桁の数字のみ対応しており、
会社名からの検索は未対応です(今後の課題)。

> **注記**: J-Quants API V2 の公式リファレンスサイトは、開発時点でこの環境から
> 到達できず(DNS解決不可)、レスポンスのフィールド名を一次情報で確認できていません。
> `jquantsClient.ts` の `extractBars` / `pickString` / `pickNumber` は、ラッパーキー
> (`daily_quotes` / `daily_bars` / `bars` / `data`)や日付・終値のキー名の候補を
> 複数チェックする防御的な実装にしてあります。想定外のレスポンス形式の場合は
> `console.error` でレスポンスの先頭部分をログ出力するので、Vercel の Logs で
> 実際のJSON構造を確認し、必要なら候補キーを追加してください。

予測は直近30営業日の終値に単純な線形回帰を当てはめて延長するフェーズ1の方式です
(`src/lib/forecast/linearRegression.ts`)。あくまで参考情報であり、投資助言ではありません。
