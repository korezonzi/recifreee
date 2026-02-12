# ReciFreee

AI-OCR領収書 → freee経費インポートツール

## Deploy

- **Vercel** でデプロイ（`master` ブランチにpushで自動デプロイ）

## Dev

- Node.js 22 (`.nvmrc` 参照)
- `npm run dev` — 開発サーバー起動
- `npm run build` — プロダクションビルド
- `npm run lint` — ESLint

## Architecture

- Next.js 16 (App Router, Turbopack)
- NextAuth v5 (Google OAuth)
- Gemini API (OCR)
- Google Sheets API + Drive API (データ保存・画像整理)
