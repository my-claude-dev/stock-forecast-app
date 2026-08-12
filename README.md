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
# .env.local に BASIC_AUTH_USER / BASIC_AUTH_PASSWORD を設定
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
   - 「Deploy」をクリック

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
npm run dev     # 開発サーバー起動
npm run build   # 本番ビルド
npm run start   # 本番サーバー起動
npm run lint    # ESLint
```

## 開発状況

現在はプロジェクトの初期セットアップ(雛形作成・Basic 認証・セキュリティヘッダー)が完了した段階です。
銘柄検索・株価取得・予測・PWA 対応は今後のステップで実装します。
