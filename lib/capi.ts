// lib/capi.ts
import crypto from "crypto";
import { sendTelegramAlert } from "@/lib/alert";

const GRAPH_VERSION = "v25.0";

/** SHA-256 hash, lowercased & trimmed — required by Meta for user data. */
function hash(value?: string | null): string | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return undefined;
  return crypto.createHash("sha256").update(normalized).digest("hex");
}

/**
 * Normalize an Indonesian phone number to E.164-ish digits before hashing.
 * Meta matches better when numbers include country code and contain digits only.
 * 081234567890 -> 6281234567890
 */
function normalizePhone(phone?: string | null): string | undefined {
  if (!phone) return undefined;
  let p = phone.replace(/\D/g, "");
  if (!p) return undefined;
  if (p.startsWith("0")) p = "62" + p.slice(1);
  else if (!p.startsWith("62")) p = "62" + p;
  return p;
}

interface PixelDestination {
  pixelId: string;
  token: string;
  label: string; // for logs & Telegram alerts
}

/**
 * All configured CAPI destinations. Pixel 1 = Growlab, Pixel 2 = Neulab.
 * A destination is only active when BOTH its id and token env vars exist,
 * so removing a pair cleanly disables that pixel server-side.
 */
function getDestinations(): PixelDestination[] {
  const destinations: PixelDestination[] = [];
  if (process.env.FB_PIXEL_ID && process.env.FB_CAPI_TOKEN) {
    destinations.push({
      pixelId: process.env.FB_PIXEL_ID,
      token: process.env.FB_CAPI_TOKEN,
      label: "Pixel 1 (Growlab)",
    });
  }
  if (process.env.FB_PIXEL_ID_2 && process.env.FB_CAPI_TOKEN_2) {
    destinations.push({
      pixelId: process.env.FB_PIXEL_ID_2,
      token: process.env.FB_CAPI_TOKEN_2,
      label: "Pixel 2 (Neulab)",
    });
  }
  return destinations;
}

export interface CapiUserData {
  phoneNumber?: string | null;
  userName?: string | null;
  fbc?: string | null; // "fb.1.<ts>.<fbclid>"
  fbp?: string | null; // browser cookie _fbp, if available
  clientIp?: string | null;
  clientUserAgent?: string | null;
}

export interface SendEventParams {
  eventName: string; // "Lead" | "CompleteRegistration" | ...
  eventId: string; // shared with browser pixel for dedup
  eventSourceUrl?: string | null;
  user: CapiUserData;
  customData?: Record<string, any>;
}

/** Send one payload to one pixel. Never throws. */
async function sendToDestination(
  dest: PixelDestination,
  eventName: string,
  payload: unknown,
): Promise<boolean> {
  try {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${dest.pixelId}/events?access_token=${dest.token}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(
        `[CAPI][${dest.label}] ${eventName} failed ${res.status}: ${text}`,
      );
      // Surface silent CAPI failures (e.g. an expired token) per pixel.
      await sendTelegramAlert(
        `Meta CAPI GAGAL — ${dest.label}`,
        `${eventName} ditolak Meta (HTTP ${res.status}).\n${text.slice(0, 300)}`,
      );
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[CAPI][${dest.label}] ${eventName} error:`, err);
    await sendTelegramAlert(
      `Meta CAPI ERROR — ${dest.label}`,
      `${eventName}: ${err instanceof Error ? err.message : String(err)}`,
    );
    return false;
  }
}

/**
 * Send one event to every configured Meta Conversions API destination.
 * Returns true if at least one destination accepted it — never throws,
 * so the caller (sheet save) is never blocked by tracking.
 */
export async function sendCapiEvent(params: SendEventParams): Promise<boolean> {
  const destinations = getDestinations();

  // Tracking is optional: if nothing configured, silently skip.
  if (destinations.length === 0) return false;

  const { eventName, eventId, eventSourceUrl, user, customData } = params;

  const userData: Record<string, any> = {
    ph: hash(normalizePhone(user.phoneNumber)),
    fn: hash(user.userName),
    fbc: user.fbc || undefined,
    fbp: user.fbp || undefined,
    client_ip_address: user.clientIp || undefined,
    client_user_agent: user.clientUserAgent || undefined,
  };

  // Drop undefined keys so the payload stays clean.
  Object.keys(userData).forEach(
    (k) => userData[k] === undefined && delete userData[k],
  );

  const payload = {
    data: [
      {
        event_name: eventName,
        event_time: Math.floor(Date.now() / 1000),
        event_id: eventId,
        action_source: "website",
        event_source_url: eventSourceUrl || undefined,
        user_data: userData,
        custom_data: customData || undefined,
      },
    ],
  };

  const results = await Promise.all(
    destinations.map((dest) => sendToDestination(dest, eventName, payload)),
  );
  return results.some(Boolean);
}
