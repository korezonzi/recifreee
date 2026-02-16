# ReciFreee

AI-OCR で領収書を読み取り、freee 経費インポート用データを自動生成するツール。

## Features

- **AI-OCR**: Gemini API による領収書画像の自動データ抽出（日付・金額・店舗名・品目）
- **バッチ処理**: 最大 3 件の並行 OCR 処理キュー
- **重複検出**: バッチ内および既存データとの重複チェック
- **カテゴリ学習**: 店舗名と勘定科目の関連を学習し、次回以降自動適用
- **Google Sheets 保存**: freee インポート形式でシートに自動追記
- **Google Drive 整理**: `確定申告/YYYY年/MM月` フォルダ構造で画像を自動整理
- **処理履歴**: 保存済みデータの検索・フィルタ・ソート
- **ダークモード**: システム設定に連動したテーマ切り替え
- **カメラ撮影**: モバイル端末でのカメラ FAB

## Tech Stack

| Category | Technology |
| --- | --- |
| Framework | Next.js 16 (App Router, Turbopack) |
| Runtime | Node.js 22 |
| Auth | NextAuth v5 (Google OAuth) |
| AI/OCR | Gemini API (`@google/generative-ai`) |
| Storage | Google Sheets API / Google Drive API |
| UI | Tailwind CSS 4, Radix UI, shadcn/ui, Framer Motion |
| Language | TypeScript 5 |

## Setup

### 1. Install dependencies

```bash
nvm use        # Node.js 22
npm install
```

### 2. Environment variables

`.env.local` を作成:

```bash
# Google OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Gemini API
GEMINI_API_KEY=

# Access control (comma-separated, empty = allow all)
ALLOWED_EMAILS=
```

Google Cloud Console で OAuth 2.0 クライアントを作成し、以下のスコープを許可:

- `openid`, `email`, `profile`
- `https://www.googleapis.com/auth/drive.file`
- `https://www.googleapis.com/auth/spreadsheets`

### 3. Run dev server

```bash
npm run dev
```

http://localhost:3000 でアクセス。

## Deploy

### Vercel

`master` ブランチへの push で自動デプロイ。環境変数を Vercel のプロジェクト設定で登録する。

### Docker

```bash
docker build -t recifreee .
docker run -p 3000:3000 --env-file .env.local recifreee
```

## API Endpoints

| Method | Path | Description |
| --- | --- | --- |
| POST | `/api/ocr` | 領収書画像の OCR 処理 |
| POST | `/api/sheets` | Google Sheets へデータ追記 |
| GET | `/api/sheets?year=YYYY` | 保存済みデータ取得 |
| POST | `/api/drive` | Google Drive へ画像アップロード |
| GET | `/api/usage` | 月次使用量データ取得 |
| GET | `/api/settings` | ユーザー設定取得 |
| PUT | `/api/settings` | ユーザー設定更新 |
| POST | `/api/categories` | 店舗-カテゴリマッピング記録 |
