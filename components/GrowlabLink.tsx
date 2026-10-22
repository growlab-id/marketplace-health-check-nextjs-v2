"use client";

import { useEffect, useState } from "react";

/**
 * Tautan ke growlab.id yang teksnya menyesuaikan asal pengunjung.
 *
 * - Datang dari growlab.id  -> "← Kembali ke growlab.id"
 * - Datang langsung/lainnya -> "Dibuat oleh Growlab — agency marketplace ..."
 *
 * Versi "Dibuat oleh Growlab" dirender lebih dulu di server, lalu diganti di
 * browser bila pengunjung ternyata berasal dari growlab.id. Tinggi wadahnya
 * dikunci supaya pergantian teks tidak menggeser tata letak.
 */

const SESSION_KEY = "mhc_asal_growlab";

/** Hanya growlab.id (dan www), bukan subdomain aplikasi ini sendiri. */
function isGrowlabHost(host: string): boolean {
  return host === "growlab.id" || host === "www.growlab.id";
}

export default function GrowlabLink() {
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

  const href = dariGrowlab
    ? "https://growlab.id"
    : "https://growlab.id/?utm_source=marketplace-health&utm_medium=referral&utm_campaign=tautan-aplikasi";

  return (
    <div className="w-full">
      <div className="max-w-4xl mx-auto px-4 md:px-8 pt-3">
        {/* Tinggi dikunci agar kedua versi teks tidak menggeser tata letak. */}
        <div className="h-10 flex items-center">
          <a
            href={href}
            className="inline-flex items-center text-[11px] md:text-xs font-semibold text-slate-500 hover:text-indigo-600 transition-colors leading-tight"
          >
            {dariGrowlab ? (
              <>&larr; Kembali ke growlab.id</>
            ) : (
              <>
                Dibuat oleh Growlab — agency marketplace Shopee &amp; TikTok
                Shop &rarr;
              </>
            )}
          </a>
        </div>
      </div>
    </div>
  );
}
