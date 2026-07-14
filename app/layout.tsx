import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "Marketplace Health Check - Growlab Tools",
  description: "Dapatkan skor kesehatan toko Anda secara cepat dan akurat berdasarkan performa toko Anda",
};

const FB_PIXEL_ID = process.env.NEXT_PUBLIC_FB_PIXEL_ID;
// Second pixel (e.g. Neulab). Optional — everything works with one pixel
// if this env var is absent.
const FB_PIXEL_ID_2 = process.env.NEXT_PUBLIC_FB_PIXEL_ID_2;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body>
        {FB_PIXEL_ID && (
          <>
            <Script id="fb-pixel" strategy="afterInteractive">
              {`
                !function(f,b,e,v,n,t,s)
                {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
                n.callMethod.apply(n,arguments):n.queue.push(arguments)};
                if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
                n.queue=[];t=b.createElement(e);t.async=!0;
                t.src=v;s=b.getElementsByTagName(e)[0];
                s.parentNode.insertBefore(t,s)}(window, document,'script',
                'https://connect.facebook.net/en_US/fbevents.js');
                fbq('set', 'autoConfig', false, '${FB_PIXEL_ID}');
                ${FB_PIXEL_ID_2 ? `fbq('set', 'autoConfig', false, '${FB_PIXEL_ID_2}');` : ""}
                fbq('init', '${FB_PIXEL_ID}');
                ${FB_PIXEL_ID_2 ? `fbq('init', '${FB_PIXEL_ID_2}');` : ""}
                fbq('track', 'PageView');
              `}
            </Script>
            <noscript>
              <img
                height="1"
                width="1"
                style={{ display: "none" }}
                src={`https://www.facebook.com/tr?id=${FB_PIXEL_ID}&ev=PageView&noscript=1`}
                alt=""
              />
              {FB_PIXEL_ID_2 && (
                <img
                  height="1"
                  width="1"
                  style={{ display: "none" }}
                  src={`https://www.facebook.com/tr?id=${FB_PIXEL_ID_2}&ev=PageView&noscript=1`}
                  alt=""
                />
              )}
            </noscript>
          </>
        )}
        {children}
      </body>
    </html>
  );
}
