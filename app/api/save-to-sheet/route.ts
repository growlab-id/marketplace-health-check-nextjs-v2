import { NextRequest, NextResponse } from "next/server";
import { GoogleSpreadsheet } from "google-spreadsheet";
import { JWT } from "google-auth-library";
import { sendCapiEvent } from "@/lib/capi";
import { sendTelegramAlert } from "@/lib/alert";

// Prefer the env var; fall back to the known ID so nothing breaks if unset.
const SPREADSHEET_ID =
  process.env.SPREADSHEET_ID || "10gCm-fgHZ6eUY_-W0CGv-1JzFNtZDX7aeNdNUy24dnI";

// Only these sheets may be written. Anything else is rejected, so the open
// endpoint can't be abused to create arbitrary tabs or fire fake CAPI events.
const ALLOWED_SHEETS = new Set([
  "partial_submit_v2",
  "full_submit_v2",
  "partial_submit",
  "full_submit",
]);

// Cap string fields so oversized payloads can't blow past Google's
// 50,000-character-per-cell limit (which would turn addRow into a 500).
const cap = (v: unknown, max = 200): string =>
  typeof v === "string" ? v.slice(0, max) : "";

// v1 (legacy form with per-product numbers) — kept for archival compatibility.
const EXPECTED_HEADERS_V1 = [
  "Timestamp", "SubmissionId", "Platform", "Name", "Shop Name", "Phone",
  "GMV Month 3", "GMV Month 2", "GMV Month 1",
  "Product 1 Name", "Product 1 GMV", "Product 1 Price", "Product 1 HPP", "Product 1 Ad Spend", "Product 1 ROAS/ROI",
  "Product 2 Name", "Product 2 GMV", "Product 2 Price", "Product 2 HPP", "Product 2 Ad Spend", "Product 2 ROAS/ROI",
  "Product 3 Name", "Product 3 GMV", "Product 3 Price", "Product 3 HPP", "Product 3 Ad Spend", "Product 3 ROAS/ROI",
  "Final Score"
];

// v2 (quiz-based funnel). Each write contains the FULL snapshot of answers,
// so the LATEST row per SubmissionId is always the complete, current state.
const EXPECTED_HEADERS_V2 = [
  "Timestamp", "SubmissionId", "Platform", "Name", "Shop Name", "Phone",
  "GMV Answer",
  "Trend Answer", "Concentration Answer", "Margin Answer", "ROAS Answer",
  "Final Score"
];

async function ensureHeaders(
  sheet: any,
  requestId: string,
  expectedHeaders: string[],
) {
  if (sheet.columnCount < expectedHeaders.length) {
    await sheet.resize({
      rowCount: sheet.rowCount || 100,
      columnCount: expectedHeaders.length
    });
  }

  // IMPORTANT: sheet.headerValues is a getter that THROWS when headers are
  // not loaded (e.g. a manually-created empty tab). Never read it outside
  // a try/catch — track the loaded headers in a local variable instead.
  let headers: string[] = [];
  try {
    await sheet.loadHeaderRow();
    headers = sheet.headerValues ?? [];
  } catch {
    console.log(`[${requestId}] No header row yet on "${sheet.title}".`);
    headers = [];
  }

  if (headers.length === 0) {
    await sheet.setHeaderRow(expectedHeaders);
    try {
      await sheet.loadHeaderRow();
      headers = sheet.headerValues ?? [];
    } catch {
      headers = [];
    }
    if (headers.length === 0) {
      throw new Error(`Failed to set headers for sheet "${sheet.title}".`);
    }
    return;
  }

  // Schema migration: if the sheet already exists but is missing some of
  // the expected columns (e.g. "GMV Answer" added later), append the
  // missing headers at the END so existing data columns never shift.
  const missing = expectedHeaders.filter((h) => !headers.includes(h));
  if (missing.length > 0) {
    const merged = [...headers, ...missing];
    if (sheet.columnCount < merged.length) {
      await sheet.resize({
        rowCount: sheet.rowCount || 100,
        columnCount: merged.length,
      });
    }
    await sheet.setHeaderRow(merged);
    await sheet.loadHeaderRow();
    console.log(
      `[${requestId}] Extended "${sheet.title}" headers with: ${missing.join(", ")}`,
    );
  }
}

export async function POST(req: NextRequest) {
  const requestId = Math.random().toString(36).substring(7);
  console.log(`[${requestId}] Received save-to-sheet request`);

  try {
    const body = await req.json();
    const {
      sheetName = "full_submit_v2",
      // tracking fields (not written to the sheet)
      fbc,
      fbp,
      eventId,
      eventSourceUrl,
      ...data
    } = body;

    const isV2 = typeof sheetName === "string" && sheetName.endsWith("_v2");
    const isFull =
      typeof sheetName === "string" && sheetName.startsWith("full_submit");

    if (typeof sheetName !== "string" || !ALLOWED_SHEETS.has(sheetName)) {
      return NextResponse.json(
        { error: "Invalid sheet name." },
        { status: 400 },
      );
    }

    const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    let privateKey = process.env.GOOGLE_PRIVATE_KEY;

    if (!serviceAccountEmail || !privateKey) {
      return NextResponse.json(
        { error: "Server configuration error: Missing Google credentials." },
        { status: 500 }
      );
    }

    // Handle escaped newlines in private key
    privateKey = privateKey.replace(/\\n/g, "\n");
    if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
      privateKey = privateKey.substring(1, privateKey.length - 1);
    }

    const serviceAccountAuth = new JWT({
      email: serviceAccountEmail,
      key: privateKey,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const doc = new GoogleSpreadsheet(SPREADSHEET_ID, serviceAccountAuth);
    await doc.loadInfo();

    let sheet = doc.sheetsByTitle[sheetName];
    if (!sheet) {
      // Create the sheet WITH its headers in one step, so a brand-new tab
      // never exists in a headerless state.
      try {
        sheet = await doc.addSheet({
          title: sheetName,
          headerValues: isV2 ? EXPECTED_HEADERS_V2 : EXPECTED_HEADERS_V1,
        });
      } catch {
        // Race: a concurrent request created it first. Reload and reuse.
        await doc.loadInfo();
        sheet = doc.sheetsByTitle[sheetName];
        if (!sheet) {
          throw new Error(`Failed to create or find sheet "${sheetName}".`);
        }
      }
    }

    await ensureHeaders(
      sheet,
      requestId,
      isV2 ? EXPECTED_HEADERS_V2 : EXPECTED_HEADERS_V1,
    );

    const common = {
      Timestamp: new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" }),
      SubmissionId: cap(data.submissionId, 64),
      Platform: cap(data.platform, 30),
      Name: cap(data.userName),
      "Shop Name": cap(data.shopName),
      Phone: cap(data.phoneNumber, 30),
    };

    const finalScore =
      data.score !== undefined && data.score !== null && isFull
        ? Number(data.score).toFixed(2)
        : "";

    const row = isV2
      ? {
          ...common,
          "GMV Answer": cap(data.gmvAnswer, 100),
          "Trend Answer": cap(data.trendAnswer, 100),
          "Concentration Answer": cap(data.concentrationAnswer, 100),
          "Margin Answer": cap(data.marginAnswer, 100),
          "ROAS Answer": cap(data.roasAnswer, 100),
          "Final Score": finalScore,
        }
      : {
          ...common,
          "GMV Month 3": data.monthlyRevenue?.[0] ?? "",
          "GMV Month 2": data.monthlyRevenue?.[1] ?? "",
          "GMV Month 1": data.monthlyRevenue?.[2] ?? "",
          "Product 1 Name": data.topProducts?.[0]?.name ?? "",
          "Product 1 GMV": data.topProducts?.[0]?.revenue ?? "",
          "Product 1 Price": data.topProducts?.[0]?.price ?? "",
          "Product 1 HPP": data.topProducts?.[0]?.hpp ?? "",
          "Product 1 Ad Spend": data.topProducts?.[0]?.adSpend ?? "",
          "Product 1 ROAS/ROI": data.topProducts?.[0]?.roasRoi ?? "",
          "Product 2 Name": data.topProducts?.[1]?.name ?? "",
          "Product 2 GMV": data.topProducts?.[1]?.revenue ?? "",
          "Product 2 Price": data.topProducts?.[1]?.price ?? "",
          "Product 2 HPP": data.topProducts?.[1]?.hpp ?? "",
          "Product 2 Ad Spend": data.topProducts?.[1]?.adSpend ?? "",
          "Product 2 ROAS/ROI": data.topProducts?.[1]?.roasRoi ?? "",
          "Product 3 Name": data.topProducts?.[2]?.name ?? "",
          "Product 3 GMV": data.topProducts?.[2]?.revenue ?? "",
          "Product 3 Price": data.topProducts?.[2]?.price ?? "",
          "Product 3 HPP": data.topProducts?.[2]?.hpp ?? "",
          "Product 3 Ad Spend": data.topProducts?.[2]?.adSpend ?? "",
          "Product 3 ROAS/ROI": data.topProducts?.[2]?.roasRoi ?? "",
          "Final Score": finalScore,
        };

    await sheet.addRow(row);
    console.log(`[${requestId}] Data saved to "${sheetName}"`);

    // ---- Conversions API (server-side) ----
    // Fire after the sheet write. Failures here never affect the response.
    try {
      const clientIp =
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        req.headers.get("x-real-ip") ||
        undefined;
      const clientUserAgent = req.headers.get("user-agent") || undefined;

      // Map the funnel stage to a standard Meta event.
      const eventName = isFull ? "CompleteRegistration" : "Lead";

      // Use the shared submissionId-based id so the browser pixel
      // and this server event get deduplicated by Meta.
      const finalEventId =
        eventId || `${eventName}_${data.submissionId ?? requestId}`;

      const customData: Record<string, any> = {};
      if (isFull && typeof data.score === "number") {
        // Health score 0–5 as a custom property — not `value`/`currency`,
        // which Meta treats as monetary conversion value.
        customData.score = data.score;
      }

      await sendCapiEvent({
        eventName,
        eventId: finalEventId,
        eventSourceUrl,
        user: {
          phoneNumber: data.phoneNumber,
          userName: data.userName,
          fbc,
          fbp,
          clientIp,
          clientUserAgent,
        },
        customData,
      });
    } catch (capiErr) {
      console.error(`[${requestId}] CAPI block error (ignored):`, capiErr);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error(`[${requestId}] Error:`, error);
    await sendTelegramAlert(
      "save-to-sheet ERROR",
      `[${requestId}] ${error?.message || String(error)}`,
    );
    return NextResponse.json(
      { error: error.message || "Failed to save data" },
      { status: 500 }
    );
  }
}
