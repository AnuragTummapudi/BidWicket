import { Suspense } from 'react';
import Script from 'next/script';
import { Analytics } from "@vercel/analytics/react"
import { SpeedInsights } from "@vercel/speed-insights/next"
import { Barlow, Barlow_Condensed } from 'next/font/google';
import './globals.css';
import { GameProvider } from './GameContext';
import ChaiSupport from './components/ChaiSupport';
import { createMetadata, SITE_URL } from './lib/seo';

const barlow = Barlow({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-barlow', display: 'swap' });
const barlowCondensed = Barlow_Condensed({ subsets: ['latin'], weight: ['500', '600'], variable: '--font-barlow-condensed', display: 'swap' });

export const metadata = {
  ...createMetadata({
    title: 'IPL Auction Simulator - Play IPL Mega Auction Online with Friends',
    description: 'Play a free IPL Auction Simulator online with friends. Create mock IPL auction rooms, bid in real time, manage your purse, and build a fantasy IPL squad.',
    path: '/',
  }),
  metadataBase: new URL(SITE_URL),
  applicationName: 'IPL Auction Simulator',
  appleWebApp: {
    capable: true,
    title: 'IPL Auction Simulator',
    statusBarStyle: 'black-translucent',
  },
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '32x32' },
      { url: '/assets/favicon.png', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
    apple: '/assets/favicon.png',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0b0d14',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${barlow.variable} ${barlowCondensed.variable}`} suppressHydrationWarning>
      <head>
        <meta name="google-adsense-account" content="ca-pub-2556312199314107" />
        <link rel="dns-prefetch" href="https://images.icc-cricket.com" />
        <link rel="dns-prefetch" href="https://documents.iplt20.com" />
        {/* Google tag (gtag.js) */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-K3B8D7K8YY"
          strategy="afterInteractive"
        />
        <Script
          id="google-adsense"
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-2556312199314107"
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());

            gtag('config', 'G-K3B8D7K8YY');
          `}
        </Script>
      </head>
      <body>
        <GameProvider>{children}</GameProvider>
        <ChaiSupport />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
