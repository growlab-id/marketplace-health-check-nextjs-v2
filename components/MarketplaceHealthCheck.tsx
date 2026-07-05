"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  BarChart3,
  TrendingUp,
  Target,
  DollarSign,
  Star,
  ChevronRight,
  ChevronLeft,
  RefreshCcw,
  AlertCircle,
  AlertTriangle,
  Store,
  Zap,
  PieChart,
  Users,
  Eye,
  MessageCircle,
} from "lucide-react";
import * as fbq from "@/lib/fpixel";

type Platform = "Shopee" | "Tiktok";

// ---------------------------------------------------------------------------
// Quiz configuration
// ---------------------------------------------------------------------------

interface QuizOption {
  id: string;
  label: string; // full label shown on the button & stored in the sheet
  short: string; // compact label for result cards
  points: number;
}

const GMV_OPTIONS: QuizOption[] = [
  { id: "di_bawah_5jt", label: "Kurang dari 5 juta", short: "< 5 jt", points: 0 },
  { id: "5_10jt", label: "5 – 10 juta", short: "5–10 jt", points: 0 },
  { id: "10_50jt", label: "10 – 50 juta", short: "10–50 jt", points: 0 },
  { id: "50_100jt", label: "50 – 100 juta", short: "50–100 jt", points: 0 },
  { id: "di_atas_100jt", label: "Di atas 100 juta", short: "> 100 jt", points: 0 },
];

const TREND_OPTIONS: QuizOption[] = [
  {
    id: "konsisten_naik",
    label: "Konsisten naik tiap bulan sejak 3 bulan terakhir",
    short: "Naik Stabil",
    points: 1,
  },
  {
    id: "konsisten_turun",
    label: "Konsisten turun tiap bulan sejak 3 bulan terakhir",
    short: "Menurun",
    points: 0,
  },
  {
    id: "fluktuatif",
    label: "Naik turun tiap bulan / fluktuatif",
    short: "Fluktuatif",
    points: 0.5,
  },
  { id: "tidak_tahu", label: "Tidak tahu", short: "Tidak Diketahui", points: 0 },
];

const CONCENTRATION_OPTIONS: QuizOption[] = [
  { id: "di_bawah_50", label: "Di bawah 50%", short: "< 50%", points: 1 },
  { id: "50_75", label: "50 – 75%", short: "50–75%", points: 0.5 },
  { id: "di_atas_75", label: "Di atas 75%", short: "> 75%", points: 0 },
  { id: "tidak_tahu", label: "Tidak tahu", short: "Tidak Diketahui", points: 0 },
];

const MARGIN_OPTIONS: QuizOption[] = [
  { id: "di_bawah_5", label: "Di bawah 5%", short: "< 5%", points: 0 },
  { id: "5_10", label: "5 – 10%", short: "5–10%", points: 0.5 },
  { id: "10_15", label: "10 – 15%", short: "10–15%", points: 1 },
  { id: "15_20", label: "15 – 20%", short: "15–20%", points: 1.25 },
  { id: "di_atas_20", label: "Di atas 20%", short: "> 20%", points: 1.5 },
  { id: "tidak_tahu", label: "Tidak tahu", short: "Tidak Diketahui", points: 0 },
];

const ROAS_OPTIONS: QuizOption[] = [
  { id: "di_bawah_5", label: "Di bawah 5", short: "< 5", points: 0 },
  { id: "5_7", label: "5 – 7", short: "5–7", points: 0 },
  { id: "7_10", label: "7 – 10", short: "7–10", points: 0 },
  { id: "10_20", label: "10 – 20", short: "10–20", points: 0 },
  { id: "di_atas_20", label: "Di atas 20", short: "> 20", points: 0 },
  { id: "tidak_tahu", label: "Tidak tahu", short: "Tidak Diketahui", points: 0 },
];

// Ad-efficiency points = f(margin bucket, ROAS bucket).
// Derived from the original formula: BEP ROAS = 1 / margin.
// 1.5 = clearly above BEP, 0.75 = borderline (overlapping BEP range), 0 = below.
const AD_MATRIX: Record<string, Record<string, number>> = {
  di_atas_20: { di_bawah_5: 0.75, "5_7": 1.5, "7_10": 1.5, "10_20": 1.5, di_atas_20: 1.5 },
  "15_20": { di_bawah_5: 0, "5_7": 0.75, "7_10": 1.5, "10_20": 1.5, di_atas_20: 1.5 },
  "10_15": { di_bawah_5: 0, "5_7": 0, "7_10": 0.75, "10_20": 1.5, di_atas_20: 1.5 },
  "5_10": { di_bawah_5: 0, "5_7": 0, "7_10": 0, "10_20": 0.75, di_atas_20: 1.5 },
  di_bawah_5: { di_bawah_5: 0, "5_7": 0, "7_10": 0, "10_20": 0, di_atas_20: 0.75 },
};

// Human-readable BEP ROAS range per margin bucket (BEP = 1 / margin).
const BEP_TEXT: Record<string, string> = {
  di_atas_20: "di bawah 5",
  "15_20": "5 – 6,7",
  "10_15": "6,7 – 10",
  "5_10": "10 – 20",
  di_bawah_5: "di atas 20",
};

const labelOf = (options: QuizOption[], id: string | null) =>
  options.find((o) => o.id === id)?.label ?? "";

const shortOf = (options: QuizOption[], id: string | null) =>
  options.find((o) => o.id === id)?.short ?? "";

const pointsOf = (options: QuizOption[], id: string | null) =>
  options.find((o) => o.id === id)?.points ?? 0;

// ---------------------------------------------------------------------------
// Steps & data model
// ---------------------------------------------------------------------------

const STEP = {
  PLATFORM: 0,
  PROFILE: 1,
  Q_TREND: 2,
  Q_CONC: 3,
  Q_MARGIN: 4,
  Q_ROAS: 5,
  RESULTS: 6,
} as const;

const QUIZ_TOTAL_PAGES = 5; // profile + 4 quiz questions

// Urgency copy shown under each quiz question.
// NOTE: hedged industry-style claims — replace with verified internal
// Growlab data for stronger, defensible messaging.
const FACTS: Record<number, string> = {
  [STEP.Q_TREND]:
    "Toko yang terlambat menyadari tren penurunan omzet butuh waktu pemulihan hingga 2–3x lebih lama. Makin telat terdeteksi, makin mahal biaya recovery-nya.",
  [STEP.Q_CONC]:
    "Sebagian besar toko marketplace terlalu bergantung pada segelintir produk andalan. Sekali produk itu kena banned, kehabisan stok, atau digempur kompetitor — omzet bisa anjlok dalam hitungan hari.",
  [STEP.Q_MARGIN]:
    "Banyak seller tidak sadar sedang berjualan rugi: setelah dihitung potongan platform, biaya iklan, dan operasional, margin yang terlihat 'aman' bisa habis tak bersisa.",
  [STEP.Q_ROAS]:
    "ROAS yang terlihat besar belum tentu untung. Selama masih di bawah BEP ROAS, makin besar budget iklan justru makin besar kerugiannya.",
};

interface QuizData {
  platform: Platform;
  userName: string;
  shopName: string;
  phoneNumber: string;
  gmvAnswer: string | null;
  trendAnswer: string | null;
  concentrationAnswer: string | null;
  marginAnswer: string | null;
  roasAnswer: string | null;
}

const INITIAL_DATA: QuizData = {
  platform: "Shopee",
  userName: "",
  shopName: "",
  phoneNumber: "",
  gmvAnswer: null,
  trendAnswer: null,
  concentrationAnswer: null,
  marginAnswer: null,
  roasAnswer: null,
};

const genId = () =>
  Math.random().toString(36).substring(2, 15) +
  Math.random().toString(36).substring(2, 15);

// Read a cookie fresh from the jar. Used at save-time so signals set by the
// Pixel script AFTER our mount effect (notably _fbp) are still captured.
const readCookie = (name: string): string | null => {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : null;
};

// "Live viewers" badge numbers: random per visit, 20–50 range, decreasing as
// the user advances through the funnel. Regenerated on every mount.
function genViewerCounts(): number[] {
  const counts: number[] = [];
  let current = 38 + Math.floor(Math.random() * 13); // 38–50
  for (let i = 0; i <= STEP.RESULTS; i++) {
    counts.push(Math.max(20, current));
    current -= 2 + Math.floor(Math.random() * 5); // -2..-6 per page
  }
  return counts;
}

// Session persistence — survives refresh / closing the tab (24h TTL) so a
// returning user continues with the same submissionId and answers.
const SESSION_KEY = "mhc_v2_session";
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Scoring (max 5.0 = trend 1 + concentration 1 + margin 1.5 + ads 1.5)
// ---------------------------------------------------------------------------

function calculateScoreV2(d: QuizData) {
  const trend = pointsOf(TREND_OPTIONS, d.trendAnswer);
  const concentration = pointsOf(CONCENTRATION_OPTIONS, d.concentrationAnswer);
  const profitability = pointsOf(MARGIN_OPTIONS, d.marginAnswer);

  const marginKnown =
    d.marginAnswer !== null && d.marginAnswer !== "tidak_tahu";
  const roasKnown = d.roasAnswer !== null && d.roasAnswer !== "tidak_tahu";

  let adPerformance = 0;
  if (marginKnown && roasKnown) {
    adPerformance = AD_MATRIX[d.marginAnswer!]?.[d.roasAnswer!] ?? 0;
  }

  const score = trend + concentration + profitability + adPerformance;

  return {
    score,
    details: { trend, concentration, profitability, adPerformance },
    marginKnown,
    roasKnown,
    bepText: marginKnown ? BEP_TEXT[d.marginAnswer!] : null,
  };
}

const fmtScore = (s: number) => s.toFixed(2).replace(/0$/, "");

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------


// ---------------------------------------------------------------------------
// Presentational components (defined at module level so React keeps stable
// component identities across renders — required for smooth AnimatePresence
// exit animations).
// ---------------------------------------------------------------------------

function ViewerBadge({ counts, step }: { counts: number[] | null; step: number }) {
  if (!counts) return null;
  const count = counts[Math.min(step, counts.length - 1)];
  return (
    <div className="flex justify-center mb-6">
      <div className="inline-flex items-center gap-2 bg-white border border-slate-200 rounded-full px-4 py-1.5 shadow-sm">
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
        </span>
        <Eye size={14} className="text-slate-400" />
        <span className="text-xs font-bold text-slate-600">
          {count} orang sedang mengakses halaman ini
        </span>
      </div>
    </div>
  );
}

function ProgressBar({ step }: { step: number }) {
  if (step < STEP.PROFILE || step > STEP.Q_ROAS) return null;
  const page = step; // PROFILE=1 ... Q_ROAS=5
  const pct = Math.round((page / QUIZ_TOTAL_PAGES) * 100);
  return (
    <div className="max-w-2xl mx-auto mb-6">
      <div className="flex justify-between items-center mb-2">
        <span className="text-xs font-bold text-slate-500">
          Langkah {page} dari {QUIZ_TOTAL_PAGES}
        </span>
        <span className="text-xs font-bold text-indigo-600">{pct}%</span>
      </div>
      <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
        <div
          className="bg-indigo-600 h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function QuizScreen({
  stepKey,
  icon,
  question,
  options,
  value,
  onSelect,
  onBack,
  fact,
  provisional,
}: {
  stepKey: string;
  icon: React.ReactNode;
  question: string;
  options: QuizOption[];
  value: string | null;
  onSelect: (id: string) => void;
  onBack: () => void;
  fact?: string;
  provisional?: number | null;
}) {
  return (
    <motion.div
      key={stepKey}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="card p-6 md:p-8 max-w-2xl mx-auto"
    >
      {provisional !== null && provisional !== undefined && (
        <div className="mb-6 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-5 py-4 flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-black uppercase tracking-wider text-indigo-200 flex items-center gap-1.5">
              Skor Sementara
              <span className="bg-amber-400 text-amber-950 rounded-full px-2 py-0.5 text-[10px]">
                BELUM FINAL
              </span>
            </div>
            <div className="text-2xl font-black">
              {fmtScore(provisional)}
              <span className="text-sm opacity-60">/5.0</span>
            </div>
          </div>
          <p className="text-xs font-semibold text-indigo-100 text-right max-w-[180px]">
            Selesaikan semua pertanyaan untuk melihat skor akhir Anda
          </p>
        </div>
      )}

      <div className="flex items-start gap-3 mb-6 text-indigo-600">
        <div className="mt-0.5 shrink-0">{icon}</div>
        <h2 className="text-xl font-bold text-slate-900">{question}</h2>
      </div>

      <div className="space-y-3">
        {options.map((opt) => {
          const selected = value === opt.id;
          return (
            <button
              key={opt.id}
              onClick={() => onSelect(opt.id)}
              className={`w-full text-left px-5 py-4 rounded-xl border-2 font-semibold transition-all flex items-center justify-between gap-3 group ${
                selected
                  ? "border-indigo-600 bg-indigo-50 text-indigo-900"
                  : "border-slate-200 bg-white text-slate-800 hover:border-indigo-400 hover:bg-indigo-50/50 active:scale-[0.99]"
              }`}
            >
              <span>{opt.label}</span>
              <ChevronRight
                size={20}
                className={`shrink-0 transition-all ${
                  selected
                    ? "text-indigo-600"
                    : "text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-0.5"
                }`}
              />
            </button>
          );
        })}
      </div>

      {fact && (
        <div className="mt-6 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 flex gap-3">
          <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-900 font-medium">
            <span className="font-black">Tahukah Anda? </span>
            {fact}
          </p>
        </div>
      )}

      <div className="mt-8">
        <button
          onClick={onBack}
          className="text-slate-500 hover:text-slate-800 font-semibold text-sm flex items-center gap-1 transition-colors"
        >
          <ChevronLeft size={18} /> Kembali
        </button>
      </div>
    </motion.div>
  );
}

export default function MarketplaceHealthCheck() {
  const [step, setStep] = useState<number>(STEP.PLATFORM);
  const [data, setData] = useState<QuizData>(INITIAL_DATA);
  const [submissionId, setSubmissionId] = useState(genId);

  // Generated client-side after mount (avoids SSR hydration mismatch).
  const [viewerCounts, setViewerCounts] = useState<number[] | null>(null);

  // Meta attribution signals. Captured from the URL (fbclid) and cookies,
  // so they survive even if the browser Pixel script gets blocked.
  const [fbc, setFbc] = useState<string | null>(null);
  const [fbp, setFbp] = useState<string | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string>("");

  // Reliability layer: latest data for the online-retry handler, plus a
  // pending-save slot for writes that failed after all retries.
  const latestDataRef = useRef(data);
  const pendingSaveRef = useRef<{
    sheetName: "full_submit_v2" | "partial_submit_v2";
    score?: number;
    eventId?: string;
  } | null>(null);

  useEffect(() => {
    latestDataRef.current = data;
  }, [data]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [step]);

  // Capture attribution + restore a previous session (if any) on mount.
  useEffect(() => {
    setSourceUrl(window.location.href);
    setViewerCounts(genViewerCounts());

    const fbcCookie = document.cookie.match(/_fbc=([^;]+)/);
    if (fbcCookie) {
      setFbc(decodeURIComponent(fbcCookie[1]));
    } else {
      const fbclid = new URLSearchParams(window.location.search).get("fbclid");
      if (fbclid) setFbc(`fb.1.${Date.now()}.${fbclid}`);
    }
    const fbpCookie = document.cookie.match(/_fbp=([^;]+)/);
    if (fbpCookie) setFbp(decodeURIComponent(fbpCookie[1]));

    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        const fresh =
          saved &&
          typeof saved.savedAt === "number" &&
          Date.now() - saved.savedAt < SESSION_TTL_MS;
        if (
          fresh &&
          saved.submissionId &&
          saved.data &&
          typeof saved.step === "number" &&
          saved.step >= STEP.PROFILE &&
          saved.step <= STEP.RESULTS
        ) {
          setSubmissionId(saved.submissionId);
          setData({ ...INITIAL_DATA, ...saved.data });
          setStep(saved.step);
        } else if (raw) {
          localStorage.removeItem(SESSION_KEY);
        }
      }
    } catch {
      /* corrupted session — ignore */
    }
  }, []);

  // Persist the session on every change (once the funnel has started).
  useEffect(() => {
    try {
      if (step >= STEP.PROFILE) {
        localStorage.setItem(
          SESSION_KEY,
          JSON.stringify({ submissionId, data, step, savedAt: Date.now() }),
        );
      }
    } catch {
      /* storage full/blocked — non-fatal */
    }
  }, [data, step, submissionId]);

  // When the connection comes back, flush any save that failed while offline.
  useEffect(() => {
    const onOnline = () => {
      const pending = pendingSaveRef.current;
      if (pending) {
        pendingSaveRef.current = null;
        saveToSheet(pending.sheetName, latestDataRef.current, {
          score: pending.score,
          eventId: pending.eventId,
        });
      }
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fbc, fbp, sourceUrl, submissionId]);

  // -------------------------------------------------------------------------
  // Persistence — every write sends the FULL snapshot, so the latest row per
  // SubmissionId in the sheet is always the complete, accurate state.
  // -------------------------------------------------------------------------

  const saveToSheet = useCallback(
    async (
      sheetName: "full_submit_v2" | "partial_submit_v2",
      snapshot: QuizData,
      opts: { score?: number; eventId?: string } = {},
    ) => {
      // Hybrid capture: prefer the freshest cookies at the moment of use
      // (the Pixel sets _fbp shortly AFTER mount), and fall back to the
      // values captured at mount (fbc built from the URL's fbclid keeps
      // attribution alive even when the Pixel script is blocked).
      const freshFbp = readCookie("_fbp") || fbp;
      const freshFbc = readCookie("_fbc") || fbc;

      const body = JSON.stringify({
        sheetName,
        submissionId,
        platform: snapshot.platform,
        userName: snapshot.userName,
        shopName: snapshot.shopName,
        phoneNumber: snapshot.phoneNumber,
        gmvAnswer: labelOf(GMV_OPTIONS, snapshot.gmvAnswer),
        trendAnswer: labelOf(TREND_OPTIONS, snapshot.trendAnswer),
        concentrationAnswer: labelOf(
          CONCENTRATION_OPTIONS,
          snapshot.concentrationAnswer,
        ),
        marginAnswer: labelOf(MARGIN_OPTIONS, snapshot.marginAnswer),
        roasAnswer: labelOf(ROAS_OPTIONS, snapshot.roasAnswer),
        ...(opts.score !== undefined ? { score: opts.score } : {}),
        // Meta attribution + dedup signals
        fbc: freshFbc,
        fbp: freshFbp,
        eventId: opts.eventId,
        eventSourceUrl: sourceUrl,
      });

      const maxAttempts = 3;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          const response = await fetch("/api/save-to-sheet", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body,
            // Let the request outlive the page — the final answer still
            // reaches the server even if the user closes the tab instantly.
            keepalive: true,
          });
          if (response.ok) {
            return true;
          }
        } catch (error) {
          console.error(`Save attempt ${attempt} error:`, error);
        }
        if (attempt < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, 1200 * attempt));
        }
      }

      // All retries failed (likely offline). Park it; the 'online' listener
      // and the next answer (full snapshot) will both self-heal.
      pendingSaveRef.current = {
        sheetName,
        score: opts.score,
        eventId: opts.eventId,
      };
      return false;
    },
    [submissionId, fbc, fbp, sourceUrl],
  );

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  const handlePlatformSelect = (p: Platform) => {
    setData((prev) => ({ ...prev, platform: p }));
    setStep(STEP.PROFILE);
  };

  const handleProfileSubmit = () => {
    const eventId = `Lead_${submissionId}`;
    fbq.event("Lead", { content_name: "Profiling Submitted" }, eventId);
    saveToSheet("partial_submit_v2", data, { eventId });
    setStep(STEP.Q_TREND);
  };

  // Generic quiz answer: store it, persist the full snapshot, advance.
  const answerAndGo = (
    field: keyof QuizData,
    optionId: string,
    nextStep: number,
  ) => {
    const next = { ...data, [field]: optionId };
    setData(next);
    // Reuse the Lead event_id so repeated partial writes never create a
    // second Lead on Meta's side (deduplicated).
    saveToSheet("partial_submit_v2", next, {
      eventId: `Lead_${submissionId}`,
    });
    if (nextStep === STEP.RESULTS) {
      finish(next);
    } else {
      setStep(nextStep);
    }
  };

  const finish = (snapshot: QuizData) => {
    const { score } = calculateScoreV2(snapshot);
    const eventId = `CompleteRegistration_${submissionId}`;

    fbq.event(
      "CompleteRegistration",
      {
        content_name: "Health Check Completed",
        score, // health score 0–5 as a custom property, not a monetary value
      },
      eventId,
    );

    // Fire-and-forget: results show instantly, the save retries in the
    // background and re-fires on reconnect if the network is down.
    saveToSheet("full_submit_v2", snapshot, { score, eventId });
    setStep(STEP.RESULTS);
  };

  const reset = () => {
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
    setData(INITIAL_DATA);
    setSubmissionId(genId());
    setViewerCounts(genViewerCounts());
    setStep(STEP.PLATFORM);
  };

  const results = useMemo(() => {
    if (step !== STEP.RESULTS) return null;
    return calculateScoreV2(data);
  }, [step, data]);

  const roasLabel = data.platform === "Shopee" ? "ROAS" : "ROI";

  // Provisional score: shown on quiz pages once at least one answer exists.
  const hasStartedQuiz =
    data.trendAnswer !== null ||
    data.concentrationAnswer !== null ||
    data.marginAnswer !== null ||
    data.roasAnswer !== null;
  const provisionalScore =
    hasStartedQuiz && step >= STEP.Q_TREND && step <= STEP.Q_ROAS
      ? calculateScoreV2(data).score
      : null;

  const getWAMessage = () => {
    if (!results) return "";
    return encodeURIComponent(
      `Halo Kak,\n\nSaya baru saja melakukan Marketplace Health Check dan ingin konsultasi terkait bisnis saya.\n\n*Profil Online Shop:*\n- Nama: ${data.userName}\n- Platform: ${data.platform}\n- Nama Online Shop: ${data.shopName}\n- Rata-rata Omzet/Bulan: ${shortOf(GMV_OPTIONS, data.gmvAnswer) || "-"}\n\n*Hasil Analisis Online Shop Saya:*\n- Skor Kesehatan: ${fmtScore(results.score)}/5.0\n- Tren Omzet: ${shortOf(TREND_OPTIONS, data.trendAnswer) || "-"}\n- Kontribusi Top 3 Produk: ${shortOf(CONCENTRATION_OPTIONS, data.concentrationAnswer) || "-"}\n- Margin Produk Terlaris: ${shortOf(MARGIN_OPTIONS, data.marginAnswer) || "-"}\n- ${roasLabel} Produk Terlaris: ${shortOf(ROAS_OPTIONS, data.roasAnswer) || "-"}`,
    );
  };

  // -------------------------------------------------------------------------
  // Small render helpers
  // -------------------------------------------------------------------------




  

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="min-h-screen p-4 md:p-8 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-100/50 rounded-full blur-[120px] -z-10" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-100/50 rounded-full blur-[120px] -z-10" />

      <div className="max-w-4xl mx-auto relative">
        <header
          className={`mb-8 text-center transition-all duration-500 ${step === STEP.PLATFORM ? "mt-6 mb-10 md:mt-8 md:mb-10" : ""}`}
        >
      <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={`inline-flex items-center justify-center ${step === STEP.PLATFORM ? "w-28 h-28 md:w-32 md:h-32" : "w-16 h-16 md:w-20 md:h-20"} mb-4`}
          >
            <img
              src="/growlab-logo.png"
              alt="Growlab"
              className="w-full h-full object-contain"
            />
          </motion.div>
          <motion.h1
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className={`${step === STEP.PLATFORM ? "text-2xl sm:text-4xl md:text-5xl" : "text-2xl md:text-3xl"} font-black tracking-tight text-slate-900 mb-4`}
          >
            Marketplace <span className="text-indigo-600">Health Check</span>
          </motion.h1>
          {step === STEP.PLATFORM && (
            <motion.p
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-slate-700 text-lg font-semibold max-w-xl mx-auto"
            >
              <span className="block text-2xl md:text-3xl font-black leading-snug text-slate-900">
                <span className="text-rose-600 text-4xl md:text-5xl font-black">
                  84%
                </span>{" "}
                online shop kelihatan ramai padahal{" "}
                <span className="inline-block bg-rose-100 text-rose-700 px-2.5 py-0.5 rounded-xl">
                  boncos / rugi
                </span>
              </span>
              <span className="mt-4 flex flex-wrap items-center justify-center gap-x-2 gap-y-2 text-base md:text-lg font-bold text-slate-700">
                Cek kesehatan online shop Anda dalam
                <span className="inline-flex items-center gap-1.5 bg-indigo-600 text-white px-3 py-1 rounded-full text-sm md:text-base font-black shadow-lg shadow-indigo-200">
                  <Zap size={15} /> 1 menit
                </span>
              </span>
            </motion.p>
          )}
        </header>

        <ViewerBadge counts={viewerCounts} step={step} />
        <ProgressBar step={step} />

        <main>
          <AnimatePresence mode="wait">
            {/* STEP 0 — Platform Selection */}
            {step === STEP.PLATFORM && (
              <motion.div
                key="platform"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -30 }}
                className="space-y-8 md:space-y-10"
              >
                <div className="grid grid-cols-2 gap-3 md:gap-8">
                  <button
                    onClick={() => handlePlatformSelect("Shopee")}
                    className="group relative card p-1 bg-white hover:shadow-2xl hover:shadow-orange-200/50 transition-all duration-500 border-none"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl" />
                    <div className="relative p-4 md:p-6 flex flex-col items-center gap-3 md:gap-4 border border-slate-100 rounded-2xl group-hover:border-orange-200 transition-colors">
                      <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl md:rounded-3xl bg-orange-50 flex items-center justify-center text-orange-600 shadow-inner group-hover:scale-110 transition-transform duration-500">
                        <span className="text-2xl md:text-3xl font-black">S</span>
                      </div>
                      <div className="text-center">
                        <h3 className="text-lg md:text-2xl font-black text-slate-900 mb-1 md:mb-2">
                          Shopee
                        </h3>
                        <p className="hidden md:block text-slate-700 text-sm font-bold px-4">
                          segera cek kesehatan Shopee Anda sebelum semakin buruk
                          dan sulit recovery
                        </p>
                      </div>
                      <div className="mt-2 md:mt-4 px-4 md:px-8 py-2.5 md:py-3 bg-orange-600 text-white rounded-xl font-black text-sm md:text-xl flex items-center gap-1.5 md:gap-2 shadow-lg shadow-orange-200 group-hover:bg-orange-700 transition-all group-hover:scale-105">
                        MULAI ANALISIS <ChevronRight size={18} />
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => handlePlatformSelect("Tiktok")}
                    className="group relative card p-1 bg-white hover:shadow-2xl hover:shadow-slate-300/50 transition-all duration-500 border-none"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-slate-900/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl" />
                    <div className="relative p-4 md:p-6 flex flex-col items-center gap-3 md:gap-4 border border-slate-100 rounded-2xl group-hover:border-slate-300 transition-colors">
                      <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl md:rounded-3xl bg-slate-900 flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform duration-500">
                        <span className="text-2xl md:text-3xl font-black">T</span>
                      </div>
                      <div className="text-center">
                        <h3 className="text-lg md:text-2xl font-black text-slate-900 mb-1 md:mb-2">
                          TikTok Shop
                        </h3>
                        <p className="hidden md:block text-slate-700 text-sm font-bold px-4">
                          segera cek kesehatan Tiktok Shop Anda sebelum semakin
                          buruk dan sulit recovery
                        </p>
                      </div>
                      <div className="mt-2 md:mt-4 px-4 md:px-8 py-2.5 md:py-3 bg-slate-900 text-white rounded-xl font-black text-sm md:text-xl flex items-center gap-1.5 md:gap-2 shadow-lg shadow-slate-200 group-hover:bg-black transition-all group-hover:scale-105">
                        MULAI ANALISIS <ChevronRight size={18} />
                      </div>
                    </div>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-8 border-t border-slate-200">
                  <div className="flex flex-col items-center text-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <Zap size={24} />
                    </div>
                    <div>
                      <h4 className="font-black text-slate-900 text-sm">
                        Hasil Instan
                      </h4>
                      <p className="text-xs text-slate-600 font-bold">
                        Cukup 1 Menit, Tanpa Ribet
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-center text-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                      <PieChart size={24} />
                    </div>
                    <div>
                      <h4 className="font-black text-slate-900 text-sm">
                        Metrik Akurat
                      </h4>
                      <p className="text-xs text-slate-600 font-bold">
                        Formula BEP & Profit
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-center text-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                      <Users size={24} />
                    </div>
                    <div>
                      <h4 className="font-black text-slate-900 text-sm">
                        Trusted Tool
                      </h4>
                      <p className="text-xs text-slate-600 font-bold">
                        Digunakan 1000+ Seller
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* STEP 1 — Profiling */}
            {step === STEP.PROFILE && (
              <motion.div
                key="profile"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="card p-6 md:p-8 max-w-2xl mx-auto"
              >
                <div className="flex items-center gap-2 mb-6 text-indigo-600">
                  <Users size={24} />
                  <h2 className="text-xl font-bold">Profiling</h2>
                </div>

                <div className="space-y-6 mb-8">
                  <div className="input-group">
                    <label className="label">Siapa Nama Anda?</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="Masukkan nama Anda"
                      value={data.userName}
                      onChange={(e) =>
                        setData({ ...data, userName: e.target.value })
                      }
                    />
                  </div>
                  <div className="input-group">
                    <label className="label">Nama Online Shop Anda?</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="Masukkan nama online shop Anda"
                      value={data.shopName}
                      onChange={(e) =>
                        setData({ ...data, shopName: e.target.value })
                      }
                    />
                  </div>
                  <div className="input-group">
                    <label className="label">
                      Nomor Handphone / WA Aktif Anda
                    </label>
                    <input
                      type="tel"
                      inputMode="numeric"
                      className="input"
                      placeholder="Contoh: 081234567890"
                      value={data.phoneNumber}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, "");
                        setData({ ...data, phoneNumber: val });
                      }}
                    />
                  </div>
                  <div className="input-group">
                    <label className="label">
                      Berapa rata-rata omzet / GMV per bulan online shop Anda?
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {GMV_OPTIONS.map((opt) => {
                        const selected = data.gmvAnswer === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() =>
                              setData({ ...data, gmvAnswer: opt.id })
                            }
                            className={`px-4 py-2.5 rounded-full border-2 text-sm font-bold transition-all ${
                              selected
                                ? "border-indigo-600 bg-indigo-600 text-white shadow-md shadow-indigo-200"
                                : "border-slate-200 bg-white text-slate-700 hover:border-indigo-400 hover:bg-indigo-50"
                            }`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="flex justify-between">
                  <button
                    onClick={() => setStep(STEP.PLATFORM)}
                    className="btn-secondary flex items-center gap-2"
                  >
                    <ChevronLeft size={20} /> Kembali
                  </button>
                  <button
                    onClick={handleProfileSubmit}
                    className="btn-primary flex items-center gap-2"
                    disabled={
                      !data.userName ||
                      !data.shopName ||
                      !data.phoneNumber ||
                      !data.gmvAnswer
                    }
                  >
                    Lanjut <ChevronRight size={20} />
                  </button>
                </div>
              </motion.div>
            )}

            {/* Q1 — Trend */}
            {step === STEP.Q_TREND && (
              <QuizScreen
                key="q-trend"
                stepKey="q-trend"
                icon={<TrendingUp size={26} />}
                question="Bagaimana trend / kecenderungan omzet toko Anda selama 3 bulan terakhir?"
                options={TREND_OPTIONS}
                value={data.trendAnswer}
                onSelect={(id) => answerAndGo("trendAnswer", id, STEP.Q_CONC)}
                onBack={() => setStep(STEP.PROFILE)}
                fact={FACTS[STEP.Q_TREND]}
                provisional={provisionalScore}
              />
            )}

            {/* Q2 — Concentration */}
            {step === STEP.Q_CONC && (
              <QuizScreen
                key="q-conc"
                stepKey="q-conc"
                icon={<PieChart size={26} />}
                question="Berapa % kontribusi omzet 3 produk terlaris Anda terhadap total omzet online shop Anda?"
                options={CONCENTRATION_OPTIONS}
                value={data.concentrationAnswer}
                onSelect={(id) =>
                  answerAndGo("concentrationAnswer", id, STEP.Q_MARGIN)
                }
                onBack={() => setStep(STEP.Q_TREND)}
                fact={FACTS[STEP.Q_CONC]}
                provisional={provisionalScore}
              />
            )}

            {/* Q3 — Margin (tidak tahu → straight to results) */}
            {step === STEP.Q_MARGIN && (
              <QuizScreen
                key="q-margin"
                stepKey="q-margin"
                icon={<DollarSign size={26} />}
                question="Berapa % keuntungan produk terlaris Anda setelah dikurangi berbagai biaya potongan platform?"
                options={MARGIN_OPTIONS}
                value={data.marginAnswer}
                onSelect={(id) =>
                  answerAndGo(
                    "marginAnswer",
                    id,
                    id === "tidak_tahu" ? STEP.RESULTS : STEP.Q_ROAS,
                  )
                }
                onBack={() => setStep(STEP.Q_CONC)}
                fact={FACTS[STEP.Q_MARGIN]}
                provisional={provisionalScore}
              />
            )}

            {/* Q4 — ROAS/ROI */}
            {step === STEP.Q_ROAS && (
              <QuizScreen
                key="q-roas"
                stepKey="q-roas"
                icon={<Target size={26} />}
                question={`Berapa rata-rata ${roasLabel} produk terlaris Anda dalam 1 bulan?`}
                options={ROAS_OPTIONS}
                value={data.roasAnswer}
                onSelect={(id) => answerAndGo("roasAnswer", id, STEP.RESULTS)}
                onBack={() => setStep(STEP.Q_MARGIN)}
                fact={FACTS[STEP.Q_ROAS]}
                provisional={provisionalScore}
              />
            )}

            {/* RESULTS */}
            {step === STEP.RESULTS && results && (
              <motion.div
                key="results"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-6 pb-24 md:pb-0"
              >
                <div className="card p-5 md:p-8 text-center bg-gradient-to-br from-indigo-600 to-violet-700 text-white border-none">
                  <h2 className="text-lg md:text-xl font-medium opacity-90 mb-1 md:mb-2">
                    Skor Kesehatan Toko Anda
                  </h2>
                  <div className="flex justify-center gap-2 mb-4">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        size={32}
                        fill={
                          i < Math.round(results.score)
                            ? "currentColor"
                            : "none"
                        }
                        className={
                          i < Math.round(results.score)
                            ? "text-yellow-400"
                            : "text-white/30"
                        }
                      />
                    ))}
                  </div>
                  <div className="text-5xl md:text-6xl font-black mb-2">
                    {fmtScore(results.score)}
                    <span className="text-2xl opacity-50">/5.0</span>
                  </div>
                  <p className="text-base md:text-lg font-medium text-indigo-100">
                    {results.score >= 4
                      ? "Sangat Sehat! Pertahankan performa Anda."
                      : results.score >= 3
                        ? "Cukup Sehat. Ada beberapa area yang perlu ditingkatkan."
                        : results.score >= 2
                          ? "Kurang Sehat. Segera lakukan optimasi pada toko Anda."
                          : "Kritis! Toko Anda memerlukan perbaikan menyeluruh."}
                  </p>
                  {!results.marginKnown && (
                    <p className="mt-4 text-sm font-semibold text-indigo-100/90 bg-white/10 rounded-xl px-4 py-3 inline-block">
                      Skor profitabilitas & efisiensi iklan belum bisa dinilai
                      karena margin belum diketahui — ini sendiri adalah tanda
                      bahaya untuk kesehatan toko Anda.
                    </p>
                  )}
                </div>

                <div className="space-y-6 py-4">
                  <div className="text-center space-y-2">
                    <h3 className="font-bold text-slate-900 text-lg">
                      Butuh Bantuan Lebih Lanjut?
                    </h3>
                    <p className="text-slate-600 font-medium">
                      Konsultasikan hasil Marketplace Health Check Anda dengan
                      tim expert Growlab
                    </p>
                  </div>
                  <div className="flex flex-col items-center sm:flex-row justify-center gap-4">
                    <a
                      href={`https://wa.me/6285117793478?text=${getWAMessage()}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() =>
                        fbq.event("Contact", {
                          content_name: "WhatsApp Consultation",
                        })
                      }
                      className="flex-1 max-w-xs bg-[#25D366] hover:bg-[#20ba5a] text-white font-bold py-4 px-6 rounded-xl flex items-center justify-center gap-3 transition-all shadow-lg hover:shadow-green-200 shadow-green-100"
                    >
                      <MessageCircle size={24} />
                      <span>Konsultasi dengan Alin</span>
                    </a>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="card p-6">
                    <div className="flex items-center gap-2 mb-4 text-slate-900">
                      <TrendingUp size={20} className="text-indigo-600" />
                      <h3 className="font-bold">Tren Omzet</h3>
                    </div>
                    <div className="flex items-end gap-2 mb-2">
                      <div className="text-3xl font-bold">
                        {shortOf(TREND_OPTIONS, data.trendAnswer) || "-"}
                      </div>
                      <div className="text-sm text-slate-500 mb-1">
                        +{results.details.trend} poin
                      </div>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-indigo-600 h-full transition-all"
                        style={{
                          width: `${(results.details.trend / 1) * 100}%`,
                        }}
                      ></div>
                    </div>
                  </div>

                  <div className="card p-6">
                    <div className="flex items-center gap-2 mb-4 text-slate-900">
                      <AlertCircle size={20} className="text-indigo-600" />
                      <h3 className="font-bold">Ketergantungan Produk</h3>
                    </div>
                    <div className="flex items-end gap-2 mb-2">
                      <div className="text-3xl font-bold">
                        {shortOf(
                          CONCENTRATION_OPTIONS,
                          data.concentrationAnswer,
                        ) || "-"}
                      </div>
                      <div className="text-sm text-slate-500 mb-1">
                        +{results.details.concentration} poin
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 mb-2">
                      Kontribusi Top 3 produk terhadap total omzet
                    </p>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-indigo-600 h-full transition-all"
                        style={{
                          width: `${(results.details.concentration / 1) * 100}%`,
                        }}
                      ></div>
                    </div>
                  </div>

                  <div className="card p-6">
                    <div className="flex items-center gap-2 mb-4 text-slate-900">
                      <DollarSign size={20} className="text-indigo-600" />
                      <h3 className="font-bold">Profitabilitas Produk</h3>
                    </div>
                    <div className="flex items-end gap-2 mb-2">
                      <div className="text-3xl font-bold">
                        {shortOf(MARGIN_OPTIONS, data.marginAnswer) || "-"}
                      </div>
                      <div className="text-sm text-slate-500 mb-1">
                        +{results.details.profitability} poin
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 mb-2">
                      Margin produk terlaris setelah biaya potongan platform
                    </p>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-indigo-600 h-full transition-all"
                        style={{
                          width: `${(results.details.profitability / 1.5) * 100}%`,
                        }}
                      ></div>
                    </div>
                  </div>

                  <div className="card p-6">
                    <div className="flex items-center gap-2 mb-4 text-slate-900">
                      <BarChart3 size={20} className="text-indigo-600" />
                      <h3 className="font-bold">Efisiensi Iklan</h3>
                    </div>
                    <div className="flex items-end gap-2 mb-2">
                      <div className="text-3xl font-bold">
                        {!results.marginKnown
                          ? "Tidak Dinilai"
                          : !results.roasKnown
                            ? "Tidak Diketahui"
                            : results.details.adPerformance >= 1.5
                              ? "Efisien"
                              : results.details.adPerformance > 0
                                ? "Borderline"
                                : "Tidak Efisien"}
                      </div>
                      <div className="text-sm text-slate-500 mb-1">
                        +{results.details.adPerformance} poin
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 mb-2">
                      {results.marginKnown && results.roasKnown
                        ? `${roasLabel} ${shortOf(ROAS_OPTIONS, data.roasAnswer)} dibanding ambang BEP`
                        : `Dinilai dari perbandingan ${roasLabel} dengan BEP`}
                    </p>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-indigo-600 h-full transition-all"
                        style={{
                          width: `${(results.details.adPerformance / 1.5) * 100}%`,
                        }}
                      ></div>
                    </div>
                  </div>
                </div>

                {results.bepText && (
                  <div className="card p-6 bg-indigo-50/60 border-indigo-200">
                    <div className="flex items-center gap-2 mb-2 text-indigo-700">
                      <Zap size={20} />
                      <h3 className="font-bold">
                        Estimasi BEP {roasLabel} Anda: {results.bepText}
                      </h3>
                    </div>
                    <p className="text-sm text-indigo-900/80 font-medium">
                      Dengan margin{" "}
                      {shortOf(MARGIN_OPTIONS, data.marginAnswer)}, iklan Anda
                      baru benar-benar untung jika {roasLabel} berada di atas
                      rentang tersebut (di luar biaya operasional).{" "}
                      {results.roasKnown
                        ? results.details.adPerformance >= 1.5
                          ? `${roasLabel} Anda saat ini sudah di atas ambang — pertahankan!`
                          : results.details.adPerformance > 0
                            ? `${roasLabel} Anda berada tepat di sekitar ambang — rawan boncos, perlu dioptimasi.`
                            : `${roasLabel} Anda masih di bawah ambang — iklan Anda kemungkinan besar boncos.`
                        : ""}
                    </p>
                  </div>
                )}


                <div className="flex flex-col items-center gap-3 pt-2">
                  <p className="text-slate-600 font-semibold text-center text-sm md:text-base">
                    Bahas langsung hasilnya lebih dalam dengan tim expert
                    Growlab
                  </p>
                  <a
                    href={`https://wa.me/6285117793478?text=${getWAMessage()}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() =>
                      fbq.event("Contact", {
                        content_name: "WhatsApp Consultation",
                      })
                    }
                    className="w-full max-w-xs bg-[#25D366] hover:bg-[#20ba5a] text-white font-bold py-4 px-6 rounded-xl flex items-center justify-center gap-3 transition-all shadow-lg hover:shadow-green-200 shadow-green-100"
                  >
                    <MessageCircle size={24} />
                    <span>Konsultasi dengan Inggar</span>
                  </a>
                </div>

                <div className="flex justify-center pt-4">
                  <button
                    onClick={reset}
                    className="btn-secondary flex items-center gap-2"
                  >
                    <RefreshCcw size={20} /> Mulai Ulang Analisis
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* Sticky CTA — mobile only, results page */}
        {step === STEP.RESULTS && results && (
          <div className="fixed bottom-0 left-0 right-0 z-50 p-3 bg-white/90 backdrop-blur border-t border-slate-200 md:hidden">
            <a
              href={`https://wa.me/6285117793478?text=${getWAMessage()}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() =>
                fbq.event("Contact", {
                  content_name: "WhatsApp Consultation",
                })
              }
              className="w-full bg-[#25D366] hover:bg-[#20ba5a] text-white font-bold py-3.5 px-6 rounded-xl flex items-center justify-center gap-2 shadow-lg"
            >
              <MessageCircle size={22} />
              <span>Konsultasi Gratis via WhatsApp</span>
            </a>
          </div>
        )}


        <footer className="mt-12 text-center text-slate-400 text-sm">
          &copy; {new Date().getFullYear()} Marketplace Health Check. Dibuat
          oleh PT Growlab Digital Solution
        </footer>
      </div>
    </div>
  );
}
