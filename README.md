# Marketplace Health Check v2 — Growlab Tools

Kuis tap-first untuk menghitung skor kesehatan toko marketplace (Shopee / TikTok Shop),
dengan penyimpanan lead ke Google Sheets dan tracking Meta Pixel + Conversions API.

## Arsitektur singkat
- `components/MarketplaceHealthCheck.tsx` — seluruh funnel (platform → profiling → 4 pertanyaan → hasil), skoring, sesi 24 jam di localStorage, antrean offline.
- `app/api/save-to-sheet/route.ts` — tulis ke Google Sheets (tab `partial_submit_v2` / `full_submit_v2`) lalu kirim event Lead / CompleteRegistration ke Meta CAPI.
- `lib/fpixel.ts` — helper Meta Pixel browser (dedup via eventID).
- `lib/capi.ts` — helper Meta Conversions API server (hash SHA-256, fbc/fbp, IP, UA).

## Environment variables (set di Vercel)
Lihat `.env.example`. Wajib: `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`,
`NEXT_PUBLIC_FB_PIXEL_ID`, `FB_PIXEL_ID`, `FB_CAPI_TOKEN`. Opsional: `SPREADSHEET_ID`.

## Aturan baca Google Sheet
Satu user = beberapa baris (satu per jawaban, snapshot penuh).
Baris TERLENGKAP per `SubmissionId` = data terkini.
Jumlah baris per `SubmissionId` = sampai pertanyaan mana user bertahan.

## Development
```bash
npm install
cp .env.example .env.local   # isi nilainya
npm run dev
```
