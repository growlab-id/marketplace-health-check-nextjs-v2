// lib/alert.ts
// Sends error alerts to Telegram. Fail-safe by design: if the env vars are
// missing or Telegram is unreachable, it silently does nothing — alerting
// must never break the feature it is watching.

const THROTTLE_MS = 5 * 60 * 1000; // max 1 alert per category per 5 minutes
const lastSent = new Map<string, number>();

export async function sendTelegramAlert(
  category: string,
  message: string,
): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  // Per-warm-instance throttle so an error storm (e.g. a 429 quota wave)
  // doesn't flood the chat with hundreds of identical messages.
  const now = Date.now();
  if (now - (lastSent.get(category) ?? 0) < THROTTLE_MS) return;
  lastSent.set(category, now);

  const time = new Date().toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
  });
  const text =
    `🚨 Marketplace Health Check\n` +
    `Kategori: ${category}\n` +
    `Waktu: ${time} WIB\n\n` +
    message.slice(0, 800);

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    /* never let alerting break the caller */
  }
}
