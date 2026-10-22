"use client";

import { useEffect, useState } from "react";

/**
 * Tautan ke growlab.id. Teks DAN posisinya menyesuaikan asal pengunjung:
 *
 * - Datang dari growlab.id  -> "← Kembali ke growlab.id" di ATAS halaman,
 *   supaya jalan pulangnya mudah dijangkau.
 * - Datang langsung/lainnya -> "Dibuat oleh Growlab — agency marketplace
 *   Shopee & TikTok Shop →" di BAWAH halaman, supaya tidak mendorong ajakan
 *   utama aplikasi ke bawah.
 *
 * Pemeriksaan asal hanya bisa dilakukan di browser, jadi HTML server selalu
 * menampilkan versi bawaan (bawah). Bila ternyata pengunjung dari growlab.id,
 * tautan atas muncul setelah halaman dimuat.
 */

const SESSION_KEY = "mhc_asal_growlab";

/** Hanya growlab.id (dan www), bukan subdomain aplikasi ini sendiri. */
function isGrowlabHost(host: string): boolean {
  return host === "growlab.id" || host === "www.growlab.id";
}

export default function GrowlabLink({
  position,
}: {
  position: "top" | "bottom";
}) {
  // Nilai awal harus sama dengan hasil render server agar tidak terjadi
  // ketidakcocokan hidrasi.
  const [dariGrowlab, setDariGrowlab] = useState(false);

  useEffect(() => {
    try {
      // Hasil pemeriksaan disimpan per sesi, supaya tetap berlaku saat
      // pengunjung memuat ulang halaman dalam kunjungan yang sama.
      const tersimpan = sessionStorage.getItem(SESSION_KEY);
      if (tersimpan !== null) {
        setDariGrowlab(tersimpan === "1");
        return;
      }

      // 1) Utamakan parameter utm_source.
      const utmSource = new URLSearchParams(window.location.search).get(
        "utm_source",
      );
      let hasil = utmSource === "growlab.id";

      // 2) Cadangan: periksa perujuk (referrer).
      if (!hasil && document.referrer) {
        try {
          hasil = isGrowlabHost(new URL(document.referrer).hostname);
        } catch {
          /* perujuk tidak valid — abaikan */
        }
      }

      sessionStorage.setItem(SESSION_KEY, hasil ? "1" : "0");
      setDariGrowlab(hasil);
    } catch {
      /* sessionStorage diblokir — biarkan versi bawaan */
    }
  }, []);

  // Tiap posisi hanya tampil untuk kondisi yang sesuai.
  if (position === "top" && !dariGrowlab) return null;
  if (position === "bottom" && dariGrowlab) return null;

  if (position === "top") {
    return (
      <div className="w-full">
        <div className="max-w-4xl mx-auto px-4 md:px-8 pt-2">
          <div className="h-8 flex items-center">
            <a
              href="https://growlab.id"
              className="inline-flex items-center text-[11px] md:text-xs font-semibold text-slate-500 hover:text-indigo-600 transition-colors leading-tight"
            >
              &larr; Kembali ke growlab.id
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    // pb besar di HP supaya tidak tertutup tombol WhatsApp melayang
    // di halaman hasil.
    <div className="w-full pb-24 md:pb-8">
      <div className="max-w-4xl mx-auto px-4 md:px-8">
        <div className="flex justify-center text-center">
          <a
            href="https://growlab.id/?utm_source=marketplace-health&utm_medium=referral&utm_campaign=tautan-aplikasi"
            className="inline-flex items-center text-[11px] md:text-xs font-semibold text-slate-500 hover:text-indigo-600 transition-colors leading-tight"
          >
            Dibuat oleh Growlab — agency marketplace Shopee &amp; TikTok Shop
            &rarr;
          </a>
        </div>
      </div>
    </div>
  );
}
