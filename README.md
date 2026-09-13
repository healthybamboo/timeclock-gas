# 打刻システム (clasp + Google Apps Script + TypeScript + React)

AKASHI 風のシンプルな勤怠打刻 Web アプリです。データは Google スプレッドシートに保存されます。

## 機能

- 出勤 / 退勤の打刻 (二重打刻防止、日跨ぎ退勤対応)
- 月ごとの勤務表 (出勤・退勤・休憩・労働時間・備考、出勤日数と総労働時間)
- 勤怠のあとから編集 / 追加 / 削除 (打刻忘れ対応)
- 打刻・編集の操作履歴 (監査ログ)
- 年間集計タブ (月別労働時間の棒グラフ、年間労働時間・出勤日数・平均、月別テーブル)
- 月の目標労働時間 (既定 40 時間、ヘッダーの ⚙ から変更可)。勤務表に暦日按分した「今日時点の目安」との比較と進捗バー、集計に目標ラインと目標比を表示
- ユーザーは Google アカウントのメールアドレスで識別 (1 つのシートで複数人利用可)

## 構成

```
src/
  shared/    サーバー・クライアント共通の型と日時ユーティリティ
  server/    GAS 側 (index.ts が公開 API。sheet.ts がスプレッドシート I/O)
  client/    React アプリ (Vite で 1 つの index.html にバンドル)
scripts/build-server.mjs   esbuild で GAS 用 Code.js を生成
dist/                      ビルド成果物 (clasp の rootDir)
```

- クライアント → サーバーの呼び出しは `google.script.run` を Promise 化した `src/client/api.ts` 経由
- `npm run dev` では `google.script.run` が無いので localStorage ベースのモック (`mockServer.ts`) で動きます

### スプレッドシートのシート

| シート    | 列                                                                             |
| --------- | ------------------------------------------------------------------------------ |
| `Records` | id, date, email, clockIn, clockOut, breakMinutes, note, workMinutes, updatedAt |
| `Logs`    | timestamp, email, type (IN/OUT/EDIT/DELETE), detail                            |
| `Settings` | email, monthlyTargetMinutes, updatedAt (ユーザーごとの目標労働時間)                |

初回アクセス時に自動で作成されます。日時は `YYYY-MM-DDTHH:mm` の文字列として保存します (列は書式なしテキスト)。

## セットアップ

```bash
npm install
npx clasp login          # 初回のみ。Apps Script API を https://script.google.com/home/usersettings で有効化しておく
```

### 新規にスプレッドシート + スクリプトを作る場合

```bash
npx clasp create --type sheets --title "打刻システム" --rootDir dist
```

`.clasp.json` が生成され、スプレッドシートとコンテナバインドのスクリプトが作られます。

### 既存のスクリプトに紐付ける場合

```bash
npx clasp clone <scriptId> --rootDir dist
```

スタンドアロンのスクリプトを使う場合は、スクリプトプロパティ `SPREADSHEET_ID` に保存先スプレッドシートの ID を設定してください。

## ビルドとデプロイ

```bash
npm run dev        # ローカル開発 (モックデータ)
npm run typecheck
npm run build      # dist/index.html, dist/Code.js, dist/appsscript.json を生成
npm run push       # build + clasp push
npm run open       # スクリプトエディタを開く
```

Web アプリとして公開するには、スクリプトエディタで「デプロイ > 新しいデプロイ > ウェブアプリ」を選び、

- 次のユーザーとして実行: **自分**
- アクセスできるユーザー: **組織内の全員** (Google Workspace の場合)

で公開します。以降は `npm run deploy` (`clasp deploy`) でも更新できます。

### ユーザー識別について

`Session.getActiveUser().getEmail()` でアクセスしているユーザーを識別します。
Google Workspace のドメイン内公開なら各ユーザーのメールが取れるので、複数人で 1 つのシートを共有できます。
個人 Google アカウントで「全員」公開にするとメールが取得できないため、デプロイ者のメール = 単一ユーザーとして動作します。
その場合はユーザーごとにデプロイするか、「アクセスできるユーザー: 自分のみ」で個人利用してください。
