import type { Config } from "tailwindcss";

const config: Config = {
  future: {
    // hover: hanya aktif di perangkat ber-kursor — mencegah "sticky hover"
    // di layar sentuh (opsi tampak terpilih saat mendarat di halaman baru).
    hoverOnlyWhenSupported: true,
  },
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
