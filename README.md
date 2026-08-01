# matsu-toolbox-api

`matsu-toolbox-api` は、ノート、ブックマーク、テキスト検査を提供する独立したリソースサーバーです。認証には `matsu-auth` を利用しますが、家計簿などの他サービスとはデータベースを共有しません。

ローカルの API は <http://localhost:18083>、Swagger UI は <http://localhost:18083/docs> で確認できます。

## 必要条件

- Docker Desktop と Docker Compose
- ホスト上で Node.js コマンドを実行する場合は Node.js 22 以上と npm
- 認証が必要な API を確認する場合は、別途起動した `matsu-auth`

## 環境構築と起動

通常のローカル開発は Docker Compose を使用します。

```bash
docker compose up --build toolbox-api
```

このコマンドで専用の PostgreSQL も起動し、migration の適用後に hot reload 付きの開発サーバーを開始します。

停止するときは、データベースの named volume を残したままサービスを終了します。

```bash
docker compose down
```

ローカルデータを意図的に破棄する場合を除き、`--volumes` は付けないでください。

## ホスト上での開発

依存関係をインストールします。

```bash
npm install
```

環境変数は [`.env.example`](./.env.example) を参照し、実行環境へ設定してください。接続先 PostgreSQL を用意してから、次の順に実行します。

```bash
npm run db:migrate
npm run dev
```

Windows PowerShell では、実行ポリシーの影響を避けるため `npm` の代わりに `npm.cmd` を使用します。

主な設定項目は次のとおりです。

- `PORT`: API の待受ポート
- `DATABASE_URL`: Toolbox 専用 PostgreSQL の接続先
- `AUTH_ISSUER` / `AUTH_AUDIENCE`: 受け入れるアクセストークンの発行者と対象
- `AUTH_JWKS_URL`: 公開鍵の取得先
- `AUTH_JWKS_CACHE_SECONDS` / `AUTH_JWKS_TIMEOUT_MILLISECONDS`: JWKS 取得のキャッシュとタイムアウト

Docker Compose でのローカル既定値は [`docker-compose.yml`](./docker-compose.yml) を正本とします。

## 開発と品質確認

変更内容に応じて、以下のローカル品質ゲートを実行します。

```bash
npm run check
npm test
npm run build
npm run openapi:check
```

`npm run check` は lint、型検査、format 確認をまとめて実行します。API 仕様の正本は [`openapi/openapi.json`](./openapi/openapi.json) です。契約を変更した場合は `npm run openapi:generate` で更新し、`npm run openapi:check` で登録済みルートとの一致を確認してください。

PostgreSQL を使う DB 統合テストは、開発 DB と分離したテスト専用 PostgreSQL を用意します。テスト用接続先を `DATABASE_URL` に指定して `npm run db:migrate` を実行した後、同じ接続先を `TEST_DATABASE_URL` に指定して実行してください。

```bash
npm run test:integration
```

通常の開発 DB、named volume、他サービスの DB を統合テストと共有しないでください。

現時点では、このリポジトリに GitHub Actions の CI は導入されていません。Pull Request 前の確認は上記ローカル品質ゲートで行います。

## 最小限の運用

稼働確認には `GET /health` を使用します。コンテナの状態とログは次のコマンドで確認できます。

```bash
docker compose ps
docker compose logs -f toolbox-api
```

migration を明示的に再確認する場合は、次を実行します。

```bash
docker compose run --rm toolbox-api npm run db:migrate
```

適用済み migration ファイルは変更せず、新しい migration を追加してください。本番向けの認証情報や秘密鍵をリポジトリへ追加しないでください。

## 関連ドキュメント

- [Toolbox API の責務と構成](https://github.com/shu-matsukubo/matsu-docs/blob/main/docs/components/toolbox-api.md)
- [API 契約](https://github.com/shu-matsukubo/matsu-docs/blob/main/docs/architecture/api-contracts.md)
- [認証とセッション](https://github.com/shu-matsukubo/matsu-docs/blob/main/docs/architecture/authentication.md)
- [CI・静的解析・品質ゲート](https://github.com/shu-matsukubo/matsu-docs/blob/main/docs/architecture/quality-gates.md)
