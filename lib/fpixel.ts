// lib/fpixel.ts
export const FB_PIXEL_ID = process.env.NEXT_PUBLIC_FB_PIXEL_ID;

declare global {
  interface Window {
    fbq?: (...args: any[]) => void;
  }
}

/**
 * Track a standard/custom event.
 * eventID is passed so Meta can deduplicate this browser event
 * against the matching server-side (CAPI) event.
 */
export const event = (
  name: string,
  options: Record<string, any> = {},
  eventID?: string,
) => {
  if (typeof window !== "undefined" && window.fbq) {
    if (eventID) {
      window.fbq("track", name, options, { eventID });
    } else {
      window.fbq("track", name, options);
    }
  }
};
