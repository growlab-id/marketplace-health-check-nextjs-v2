"use client";

import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Target,
  DollarSign,
  Star,
  ChevronRight,
  ChevronLeft,
  RefreshCcw,
  AlertCircle,
  CheckCircle2,
  Store,
  Zap,
  PieChart,
  Users,
  MessageCircle,
  Loader2,
} from "lucide-react";

type Platform = "Shopee" | "Tiktok";

interface ProductData {
  name: string;
  revenue: number | null;
  price: number | null;
  hpp: number | null;
  adSpend: number | null;
  roasRoi: number | string | null;
}

interface FormData {
  platform: Platform;
  userName: string;
  shopName: string;
  phoneNumber: string;
  monthlyRevenue: [number | null, number | null, number | null];
  topProducts: [ProductData, ProductData, ProductData];
}

const INITIAL_PRODUCT: ProductData = {
  name: "",
  revenue: null,
  price: null,
  hpp: null,
  adSpend: null,
  roasRoi: null,
};

const INITIAL_DATA: FormData = {
  platform: "Shopee",
  userName: "",
  shopName: "",
  phoneNumber: "",
  monthlyRevenue: [null, null, null],
  topProducts: [
    { ...INITIAL_PRODUCT, name: "Produk 1" },
    { ...INITIAL_PRODUCT, name: "Produk 2" },
    { ...INITIAL_PRODUCT, name: "Produk 3" },
  ],
};

export default function MarketplaceHealthCheck() {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<FormData>(INITIAL_DATA);
  const [isCalculated, setIsCalculated] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [submissionId] = useState(
    () =>
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15),
  );

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [step]);

  const formatIDR = (val: number | string | null) => {
    if (val === null || val === "") return "";
    const num = typeof val === "string" ? parseIDR(val) || 0 : (val as number);
    if (isNaN(num)) return "";
    const isShopee = data.platform === "Shopee";
    const locale = isShopee ? "id-ID" : "en-US";
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(num);
  };

  const parseIDR = (val: string) => {
    if (!val.trim()) return null;
    const isShopee = data.platform === "Shopee";
    let cleaned = val;
    if (isShopee) {
      cleaned = cleaned.split(".").join("").replace(",", ".");
    } else {
      cleaned = cleaned.split(",").join("");
    }
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? null : parsed;
  };

  const parseROAS = (val: string) => {
    if (!val.trim()) return null;
    const cleaned = val.replace(",", ".");
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? null : parsed;
  };

  // Keep server warm while user is filling the form
  useEffect(() => {
    const pingInterval = setInterval(() => {
      fetch("/api/ping").catch(() => {});
    }, 30000);
    return () => clearInterval(pingInterval);
  }, []);

  const handlePlatformSelect = (p: Platform) => {
    setData({
      ...INITIAL_DATA,
      platform: p,
      monthlyRevenue: [null, null, null],
      topProducts: [
        { ...INITIAL_PRODUCT, name: "Produk 1" },
        { ...INITIAL_PRODUCT, name: "Produk 2" },
        { ...INITIAL_PRODUCT, name: "Produk 3" },
      ],
    });
    setIsCalculated(false);
    setStep(1);
  };

  const updateRevenue = (index: number, value: string) => {
    const parsed = parseIDR(value);
    const newRev = [...data.monthlyRevenue] as [
      number | null,
      number | null,
      number | null,
    ];
    newRev[index] = parsed;
    setData((prev) => ({ ...prev, monthlyRevenue: newRev }));
  };

  const updateProduct = (
    index: number,
    field: keyof ProductData,
    value: any,
  ) => {
    let finalValue = value;
    if (
      ["revenue", "price", "hpp", "adSpend"].includes(field) &&
      typeof value === "string"
    ) {
      finalValue = parseIDR(value);
    } else if (field === "roasRoi" && typeof value === "string") {
      const filteredValue = value.replace(/[^0-9.,]/g, "");
      const parts = filteredValue.split(/[.,]/);
      if (parts.length > 2) return;
      const parsed = parseROAS(filteredValue);
      if (parsed !== null && parsed >= 1000) return;
      finalValue = filteredValue;
    }
    const newProducts = [...data.topProducts] as [
      ProductData,
      ProductData,
      ProductData,
    ];
    newProducts[index] = { ...newProducts[index], [field]: finalValue };
    setData((prev) => ({ ...prev, topProducts: newProducts }));
  };

  const calculateResults = (formData: FormData) => {
    const allRevenueZero = formData.monthlyRevenue.every((v) => !v || v === 0);
    const allProductsZero = formData.topProducts.every(
      (p) =>
        (!p.revenue || p.revenue === 0) &&
        (!p.price || p.price === 0) &&
        (!p.hpp || p.hpp === 0) &&
        (!p.adSpend || p.adSpend === 0) &&
        (typeof p.roasRoi === "string"
          ? !parseROAS(p.roasRoi) || parseROAS(p.roasRoi) === 0
          : !p.roasRoi || p.roasRoi === 0),
    );

    if (allRevenueZero && allProductsZero) {
      return {
        score: 0,
        details: {
          trend: 0,
          concentration: 0,
          profitability: 0,
          adPerformance: 0,
        },
        productResults: formData.topProducts.map(() => ({
          isProfitable: false,
          isAdGood: false,
          bep: Infinity,
        })),
        ratio: 0,
      };
    }

    let score = 0;
    const details = {
      trend: 0,
      concentration: 0,
      profitability: 0,
      adPerformance: 0,
    };

    const [m3, m2, m1] = formData.monthlyRevenue.map((v) => v || 0);
    const isUp1 = m2 > m3;
    const isUp2 = m1 > m2;
    const isDown1 = m2 < m3;
    const isDown2 = m1 < m2;

    if (isUp1 && isUp2) {
      details.trend = 1;
    } else if ((isUp1 && isDown2) || (isDown1 && isUp2)) {
      details.trend = 0.5;
    } else if (isDown1 && isDown2) {
      details.trend = 0;
    } else {
      details.trend = 0.5;
    }
    score += details.trend;

    const top3Total = formData.topProducts.reduce(
      (sum, p) => sum + (p.revenue || 0),
      0,
    );
    const lastMonthRev = formData.monthlyRevenue[2] || 0;
    const ratio = lastMonthRev > 0 ? top3Total / lastMonthRev : 0;

    if (ratio < 0.5) {
      details.concentration = 1;
    } else if (ratio < 0.75) {
      details.concentration = 0.5;
    } else {
      details.concentration = 0;
    }
    score += details.concentration;

    const marginFactor = formData.platform === "Shopee" ? 0.7 : 0.65;
    const fixedFee = 1250;
    const productResults = formData.topProducts.map((p) => {
      const price = p.price || 0;
      const hpp = p.hpp || 0;
      const marginPerUnit = price * marginFactor - fixedFee - hpp;
      const isProfitable = price * marginFactor - fixedFee > hpp;
      const bep = marginPerUnit > 0 ? 1 / (marginPerUnit / price) : Infinity;
      const currentRoasRoi =
        typeof p.roasRoi === "string"
          ? parseROAS(p.roasRoi) || 0
          : p.roasRoi || 0;
      const isAdGood = currentRoasRoi > bep;
      return { isProfitable, isAdGood, bep };
    });

    const profScore = productResults.filter((r) => r.isProfitable).length * 0.5;
    details.profitability = profScore;
    score += profScore;

    const adScore = productResults.filter((r) => r.isAdGood).length * 0.5;
    details.adPerformance = adScore;
    score += adScore;

    return { score, details, productResults, ratio };
  };

  const results = useMemo(() => {
    if (!isCalculated) return null;
    return calculateResults(data);
  }, [isCalculated, data]);

  const saveToSheet = async (
    sheetName: "full_submit" | "partial_submit",
    score?: number,
  ) => {
    let success = false;
    let attempts = 0;
    const maxAttempts = sheetName === "full_submit" ? 3 : 1;

    while (!success && attempts < maxAttempts) {
      try {
        const response = await fetch("/api/save-to-sheet", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            ...data,
            sheetName,
            submissionId,
            ...(score !== undefined ? { score } : {}),
          }),
        });
        if (response.ok) {
          success = true;
        }
      } catch (error) {
        console.error(`Save attempt ${attempts + 1} error:`, error);
      }
      attempts++;
      if (!success && attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    }
    return success;
  };

  const handleCalculate = async () => {
    setIsSaving(true);
    const currentResults = calculateResults(data);
    await saveToSheet("full_submit", currentResults.score);
    setIsSaving(false);
    setIsCalculated(true);
    setStep(4);
  };

  const reset = () => {
    setData(INITIAL_DATA);
    setStep(0);
    setIsCalculated(false);
  };

  const getWAMessage = () => {
    if (!results) return "";
    return encodeURIComponent(
      `Halo Kak,\n\nSaya baru saja melakukan Marketplace Health Check dan ingin konsultasi terkait bisnis saya.\n\n*Profil Online Shop:*\n- Nama: ${data.userName}\n- Platform: ${data.platform}\n- Nama Online Shop: ${data.shopName}\n\n*Hasil Analisis Online Shop Saya:*\n- Skor Kesehatan: ${results.score.toFixed(1)}/5.0\n- Tren Omzet: ${results.details.trend === 1 ? "Naik Stabil" : results.details.trend === 0.5 ? "Fluktuatif" : "Menurun"}\n- Ketergantungan Produk: ${(results.ratio * 100).toFixed(0)}%\n- Profitabilitas: ${results.productResults.filter((r) => r.isProfitable).length}/3 Produk Untung\n- Efisiensi Iklan: ${results.productResults.filter((r) => r.isAdGood).length}/3 Produk Efisien`,
    );
  };

  return (
    <div className="min-h-screen p-4 md:p-8 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-100/50 rounded-full blur-[120px] -z-10" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-100/50 rounded-full blur-[120px] -z-10" />

      <div className="max-w-4xl mx-auto relative">
        <header
          className={`mb-8 text-center transition-all duration-500 ${step === 0 ? "mt-12 mb-16" : ""}`}
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-600 text-white mb-4 shadow-xl shadow-indigo-200"
          >
            <Store size={32} />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="mb-8"
          >
            <span className="bg-black text-white font-black text-base md:text-lg tracking-[0.5em] uppercase px-10 py-3 rounded-2xl shadow-2xl shadow-indigo-200 inline-block border-b-4 border-indigo-800">
              GROWLAB TOOLS
            </span>
          </motion.div>
          <motion.h1
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className={`${step === 0 ? "text-4xl md:text-5xl" : "text-3xl"} font-black tracking-tight text-slate-900 mb-4`}
          >
            Marketplace <span className="text-indigo-600">Health Check</span>
          </motion.h1>
          <motion.p
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-slate-700 text-lg font-semibold max-w-xl mx-auto"
          >
            {step === 0
              ? "Dapatkan skor kesehatan toko Anda secara cepat dan akurat berdasarkan performa toko Anda"
              : "Evaluasi kesehatan toko Anda dalam hitungan menit"}
          </motion.p>
        </header>

        <main>
          <AnimatePresence mode="wait">
            {/* STEP 0 - Platform Selection */}
            {step === 0 && (
              <motion.div
                key="step0"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -30 }}
                className="space-y-12"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <button
                    onClick={() => handlePlatformSelect("Shopee")}
                    className="group relative card p-1 bg-white hover:shadow-2xl hover:shadow-orange-200/50 transition-all duration-500 border-none"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl" />
                    <div className="relative p-8 flex flex-col items-center gap-6 border border-slate-100 rounded-2xl group-hover:border-orange-200 transition-colors">
                      <div className="w-24 h-24 rounded-3xl bg-orange-50 flex items-center justify-center text-orange-600 shadow-inner group-hover:scale-110 transition-transform duration-500">
                        <span className="text-4xl font-black">S</span>
                      </div>
                      <div className="text-center">
                        <h3 className="text-2xl font-black text-slate-900 mb-2">
                          Shopee
                        </h3>
                        <p className="text-slate-700 text-sm font-bold px-4">
                          segera cek kesehatan Shopee Anda sebelum semakin buruk
                          dan sulit recovery
                        </p>
                      </div>
                      <div className="mt-6 px-8 py-3 bg-orange-600 text-white rounded-xl font-black text-xl flex items-center gap-2 shadow-lg shadow-orange-200 group-hover:bg-orange-700 transition-all group-hover:scale-105">
                        MULAI ANALISIS <ChevronRight size={24} />
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => handlePlatformSelect("Tiktok")}
                    className="group relative card p-1 bg-white hover:shadow-2xl hover:shadow-slate-300/50 transition-all duration-500 border-none"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-slate-900/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl" />
                    <div className="relative p-8 flex flex-col items-center gap-6 border border-slate-100 rounded-2xl group-hover:border-slate-300 transition-colors">
                      <div className="w-24 h-24 rounded-3xl bg-slate-900 flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform duration-500">
                        <span className="text-4xl font-black">T</span>
                      </div>
                      <div className="text-center">
                        <h3 className="text-2xl font-black text-slate-900 mb-2">
                          TikTok Shop
                        </h3>
                        <p className="text-slate-700 text-sm font-bold px-4">
                          segera cek kesehatan Tiktok Shop Anda sebelum semakin
                          buruk dan sulit recovery
                        </p>
                      </div>
                      <div className="mt-6 px-8 py-3 bg-slate-900 text-white rounded-xl font-black text-xl flex items-center gap-2 shadow-lg shadow-slate-200 group-hover:bg-black transition-all group-hover:scale-105">
                        MULAI ANALISIS <ChevronRight size={24} />
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
                        Analisis dengan Cepat
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

            {/* STEP 1 - User Info */}
            {step === 1 && (
              <motion.div
                key="step-user-info"
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
                </div>

                <div className="flex justify-between">
                  <button
                    onClick={() => {
                      setData((prev) => ({
                        ...prev,
                        userName: "",
                        phoneNumber: "",
                      }));
                      setStep(0);
                    }}
                    className="btn-secondary flex items-center gap-2"
                  >
                    <ChevronLeft size={20} /> Kembali
                  </button>
                  <button
                    onClick={() => {
                      saveToSheet("partial_submit");
                      setStep(2);
                    }}
                    className="btn-primary flex items-center gap-2"
                    disabled={
                      !data.userName || !data.shopName || !data.phoneNumber
                    }
                  >
                    Lanjut <ChevronRight size={20} />
                  </button>
                </div>
              </motion.div>
            )}

            {/* STEP 2 - Monthly Revenue */}
            {step === 2 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="card p-6 md:p-8"
              >
                <div className="flex items-center gap-2 mb-6 text-indigo-600">
                  <BarChart3 size={24} />
                  <h2 className="text-xl font-bold">
                    GMV Pesanan Siap Dikirim 3 Bulan Terakhir
                  </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  {["3 Bulan Lalu", "2 Bulan Lalu", "1 Bulan Terakhir"].map(
                    (label, i) => (
                      <div key={i} className="input-group">
                        <label className="label">{label}</label>
                        <div className="relative">
                          <input
                            type="text"
                            className="input pl-4"
                            placeholder="Masukkan nominal GMV"
                            value={formatIDR(data.monthlyRevenue[i])}
                            onChange={(e) => updateRevenue(i, e.target.value)}
                          />
                        </div>
                      </div>
                    ),
                  )}
                </div>

                <div className="flex justify-between">
                  <button
                    onClick={() => setStep(1)}
                    className="btn-secondary flex items-center gap-2"
                  >
                    <ChevronLeft size={20} /> Kembali
                  </button>
                  <button
                    onClick={() => {
                      saveToSheet("partial_submit");
                      setStep(3);
                    }}
                    className="btn-primary flex items-center gap-2"
                  >
                    Lanjut <ChevronRight size={20} />
                  </button>
                </div>
              </motion.div>
            )}

            {/* STEP 3 - Product Data */}
            {step === 3 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="card p-6 md:p-8">
                  <div className="flex items-center gap-2 mb-2 text-indigo-600">
                    <Target size={24} />
                    <h2 className="text-xl font-bold">
                      Top 3 Produk dengan GMV Pesanan Siap Dikirim Tertinggi (1
                      Bulan Terakhir)
                    </h2>
                  </div>
                  <div className="bg-indigo-50 border-l-4 border-indigo-500 p-4 rounded-r-lg mb-8">
                    <p className="text-indigo-900 font-bold mb-2">
                      Silakan masukkan data performa produk Anda khusus untuk
                      periode{" "}
                      <span className="underline decoration-2 underline-offset-4">
                        1 bulan terakhir
                      </span>
                      .
                    </p>
                    <div className="text-sm text-indigo-700 font-bold leading-relaxed">
                      {data.platform === "Shopee" ? (
                        <div>
                          <p>
                            💡 Cara cek GMV Pesanan Siap Dikirim setiap produk:
                          </p>
                          <p className="ml-6 text-indigo-800 mt-1">
                            Performa Toko &gt;&gt; Produk &gt;&gt; Performa
                            Produk &gt;&gt; Pilih Periode Data yang Sesuai
                          </p>
                        </div>
                      ) : (
                        <p>
                          💡 Cek GMV Pesanan Siap Dikirim dari setiap produk
                          pada bagian Kompas Data
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-8">
                    {data.topProducts.map((product, i) => (
                      <div
                        key={i}
                        className="p-6 rounded-xl bg-slate-50 border border-slate-200 space-y-4"
                      >
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-sm">
                            {i + 1}
                          </div>
                          <input
                            type="text"
                            className="bg-transparent border-none font-bold text-lg focus:ring-0 p-0 w-full outline-none"
                            value={product.name}
                            onChange={(e) =>
                              updateProduct(i, "name", e.target.value)
                            }
                            placeholder={`Nama Produk ${i + 1}`}
                          />
                        </div>
                        <div className="bg-indigo-50 border-l-4 border-indigo-500 p-3 rounded-r-lg">
                          <p className="text-sm text-indigo-700 font-bold">
                            Silakan masukkan data performa produk Anda khusus
                            untuk periode 1 bulan terakhir.
                          </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          <div className="input-group">
                            <label className="label">
                              GMV Pesanan Siap Dikirim
                            </label>
                            <input
                              type="text"
                              className="input pl-4 py-2 text-sm"
                              placeholder="Masukkan nominal GMV"
                              value={formatIDR(product.revenue)}
                              onChange={(e) =>
                                updateProduct(i, "revenue", e.target.value)
                              }
                            />
                          </div>
                          <div className="input-group">
                            <label className="label">
                              Harga Jual (Coret) per unit
                            </label>
                            <input
                              type="text"
                              className="input pl-4 py-2 text-sm"
                              placeholder="Masukkan harga jual"
                              value={formatIDR(product.price)}
                              onChange={(e) =>
                                updateProduct(i, "price", e.target.value)
                              }
                            />
                          </div>
                          <div className="input-group">
                            <label className="label">HPP per Unit</label>
                            <input
                              type="text"
                              className="input pl-4 py-2 text-sm"
                              placeholder="Masukkan HPP"
                              value={formatIDR(product.hpp)}
                              onChange={(e) =>
                                updateProduct(i, "hpp", e.target.value)
                              }
                            />
                          </div>
                          <div className="input-group">
                            <label className="label">Biaya Iklan</label>
                            <input
                              type="text"
                              className="input pl-4 py-2 text-sm"
                              placeholder="Masukkan biaya iklan"
                              value={formatIDR(product.adSpend)}
                              onChange={(e) =>
                                updateProduct(i, "adSpend", e.target.value)
                              }
                            />
                          </div>
                          <div className="input-group">
                            <label className="label">
                              {data.platform === "Shopee" ? "ROAS" : "ROI"}
                            </label>
                            <input
                              type="text"
                              className="input py-2 text-sm"
                              placeholder={
                                data.platform === "Shopee"
                                  ? "Contoh 12,5"
                                  : "Contoh 12.5"
                              }
                              value={product.roasRoi ?? ""}
                              onChange={(e) =>
                                updateProduct(i, "roasRoi", e.target.value)
                              }
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-between mt-8">
                    <button
                      onClick={() => setStep(2)}
                      className="btn-secondary flex items-center gap-2"
                    >
                      <ChevronLeft size={20} /> Kembali
                    </button>
                    <button
                      onClick={handleCalculate}
                      className="btn-primary flex items-center gap-2"
                      disabled={isSaving}
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="animate-spin" size={20} />
                          <span>Menyimpan Hasil Analisis...</span>
                        </>
                      ) : (
                        <>
                          Lihat Hasil <CheckCircle2 size={20} />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* STEP 4 - Results */}
            {step === 4 && results && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-6"
              >
                <div className="card p-8 text-center bg-gradient-to-br from-indigo-600 to-violet-700 text-white border-none">
                  <h2 className="text-xl font-medium opacity-90 mb-2">
                    Skor Kesehatan Toko Anda
                  </h2>
                  <div className="flex justify-center gap-2 mb-4">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        size={40}
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
                  <div className="text-6xl font-black mb-2">
                    {results.score.toFixed(1)}
                    <span className="text-2xl opacity-50">/5.0</span>
                  </div>
                  <p className="text-lg font-medium text-indigo-100">
                    {results.score >= 4
                      ? "Sangat Sehat! Pertahankan performa Anda."
                      : results.score >= 3
                        ? "Cukup Sehat. Ada beberapa area yang perlu ditingkatkan."
                        : results.score >= 2
                          ? "Kurang Sehat. Segera lakukan optimasi pada toko Anda."
                          : "Kritis! Toko Anda memerlukan perbaikan menyeluruh."}
                  </p>
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
                  <div className="flex flex-col sm:flex-row justify-center gap-4">
                    <a
                      href={`https://wa.me/6285117793478?text=${getWAMessage()}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 max-w-xs bg-[#25D366] hover:bg-[#20ba5a] text-white font-bold py-4 px-6 rounded-xl flex items-center justify-center gap-3 transition-all shadow-lg hover:shadow-green-200 shadow-green-100"
                    >
                      <MessageCircle size={24} />
                      <span>Konsultasi dengan Alin</span>
                    </a>
                    <a
                      href={`https://wa.me/6285171107290?text=${getWAMessage()}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 max-w-xs bg-[#25D366] hover:bg-[#20ba5a] text-white font-bold py-4 px-6 rounded-xl flex items-center justify-center gap-3 transition-all shadow-lg hover:shadow-green-200 shadow-green-100"
                    >
                      <MessageCircle size={24} />
                      <span>Konsultasi dengan Inggar</span>
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
                        {results.details.trend === 1
                          ? "Naik Stabil"
                          : results.details.trend === 0.5
                            ? "Fluktuatif"
                            : "Menurun"}
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
                        {(results.ratio * 100).toFixed(0)}%
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
                        {
                          results.productResults.filter((r) => r.isProfitable)
                            .length
                        }
                        /3
                      </div>
                      <div className="text-sm text-slate-500 mb-1">
                        +{results.details.profitability} poin
                      </div>
                    </div>
                    <p className="text-xs text-slate-500">
                      Produk yang memiliki margin positif setelah biaya platform
                    </p>
                  </div>

                  <div className="card p-6">
                    <div className="flex items-center gap-2 mb-4 text-slate-900">
                      <BarChart3 size={20} className="text-indigo-600" />
                      <h3 className="font-bold">Efisiensi Iklan</h3>
                    </div>
                    <div className="flex items-end gap-2 mb-2">
                      <div className="text-3xl font-bold">
                        {
                          results.productResults.filter((r) => r.isAdGood)
                            .length
                        }
                        /3
                      </div>
                      <div className="text-sm text-slate-500 mb-1">
                        +{results.details.adPerformance} poin
                      </div>
                    </div>
                    <p className="text-xs text-slate-500">
                      Produk dengan{" "}
                      {data.platform === "Shopee" ? "ROAS" : "ROI"} di atas BEP
                    </p>
                  </div>
                </div>

                <div className="card overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 border-bottom border-slate-200">
                      <tr>
                        <th className="p-4 text-sm font-bold text-slate-700">
                          Produk
                        </th>
                        <th className="p-4 text-sm font-bold text-slate-700">
                          Status Profit
                        </th>
                        <th className="p-4 text-sm font-bold text-slate-700">
                          BEP {data.platform === "Shopee" ? "ROAS" : "ROI"}
                        </th>
                        <th className="p-4 text-sm font-bold text-slate-700">
                          Status Iklan
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.topProducts.map((p, i) => (
                        <tr key={i}>
                          <td className="p-4 text-sm font-medium">
                            {p.name || `Produk ${i + 1}`}
                          </td>
                          <td className="p-4">
                            {results.productResults[i].isProfitable ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                Untung
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                Rugi
                              </span>
                            )}
                          </td>
                          <td className="p-4 text-sm font-mono">
                            {results.productResults[i].bep === Infinity
                              ? "N/A"
                              : results.productResults[i].bep.toFixed(2)}
                          </td>
                          <td className="p-4">
                            {results.productResults[i].isAdGood ? (
                              <TrendingUp
                                size={18}
                                className="text-green-600"
                              />
                            ) : (
                              <TrendingDown
                                size={18}
                                className="text-red-600"
                              />
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-center flex-col items-center gap-6 pt-4">
                  <div className="flex flex-col sm:flex-row justify-center gap-4 w-full max-w-2xl">
                    <a
                      href={`https://wa.me/6285117793478?text=${getWAMessage()}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 bg-[#25D366] hover:bg-[#20ba5a] text-white font-bold py-4 px-6 rounded-xl flex items-center justify-center gap-3 transition-all shadow-lg hover:shadow-green-200 shadow-green-100"
                    >
                      <MessageCircle size={24} />
                      <span>Konsultasi dengan Alin</span>
                    </a>
                    <a
                      href={`https://wa.me/6285171107290?text=${getWAMessage()}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 bg-[#25D366] hover:bg-[#20ba5a] text-white font-bold py-4 px-6 rounded-xl flex items-center justify-center gap-3 transition-all shadow-lg hover:shadow-green-200 shadow-green-100"
                    >
                      <MessageCircle size={24} />
                      <span>Konsultasi dengan Inggar</span>
                    </a>
                  </div>
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

        <footer className="mt-12 text-center text-slate-400 text-sm">
          &copy; {new Date().getFullYear()} Marketplace Health Check. Dibuat
          oleh PT Growlab Digital Solution
        </footer>
      </div>
    </div>
  );
}
