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

### Vercel へのデプロイ

Vercel プロジェクトの Environment Variables に `BASIC_AUTH_USER` と `BASIC_AUTH_PASSWORD` を設定してください。
未設定のままデプロイすると、アプリは常に 401 を返します。

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
