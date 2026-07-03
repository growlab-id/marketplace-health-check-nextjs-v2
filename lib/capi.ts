// lib/capi.ts
import crypto from "crypto";

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

/**
 * Send one event to the Meta Conversions API.
 * Returns true on success, false on failure — never throws,
 * so the caller (sheet save) is never blocked by tracking.
 */
export async function sendCapiEvent(params: SendEventParams): Promise<boolean> {
  const pixelId = process.env.FB_PIXEL_ID;
  const token = process.env.FB_CAPI_TOKEN;

  // Tracking is optional: if not configured, silently skip.
  if (!pixelId || !token) return false;

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

  try {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${pixelId}/events?access_token=${token}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(`[CAPI] ${eventName} failed ${res.status}: ${text}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[CAPI] ${eventName} error:`, err);
    return false;
  }
}
