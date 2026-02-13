import type { Metadata } from "next";
import { Inter, Noto_Sans_JP } from "next/font/google";
import { SessionProvider } from "next-auth/react";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

const notoSansJP = Noto_Sans_JP({
  subsets: ["latin"],
  variable: "--font-jp",
});

export const metadata: Metadata = {
  title: "ReciFreee - レシートをfreeeへ、一瞬で。",
  description:
    "領収書写真をAI-OCRで読み取り、freee会計の経費インポート形式でGoogle Sheetsに出力",
  icons: {
    icon: "/favicon.svg",
    apple: "/apple-touch-icon.png",
  },
  manifest: "/manifest.json",
  openGraph: {
    title: "ReciFreee",
    description: "レシートをfreeeへ、一瞬で。",
    images: ["/ogp.png"],
  },
};

const themeScript = `
(function(){
  try {
    var t = localStorage.getItem('recifreee-theme') || 'system';
    var d = t === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : t === 'dark';
    if (d) document.documentElement.classList.add('dark');
  } catch(e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body
        className={`${inter.variable} ${notoSansJP.variable} font-sans antialiased`}
      >
        <SessionProvider>
          {children}
          <Toaster position="top-right" richColors />
        </SessionProvider>
      </body>
    </html>
  );
}
