import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://wonderloop.app"),
  title: "WonderLoop | 好奇循环",
  description:
    "5 minutes a day. One question. One curious kid. 每天 5 分钟，陪孩子完成一次好奇心循环。",
  openGraph: {
    title: "WonderLoop | 好奇循环",
    description:
      "Bilingual curiosity audio for Chinese North American families. 面向北美华人家庭的每日双语好奇心音频。",
    images: [
      {
        url: "/images/wonderloop-hero-og.jpg",
        width: 1200,
        height: 580,
        alt: "A parent and child listening together at home"
      }
    ],
    locale: "en_US",
    alternateLocale: ["zh_CN"],
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: "WonderLoop | 好奇循环",
    description:
      "5 minutes a day. One question. One curious kid. 每天 5 分钟，陪孩子完成一次好奇心循环。",
    images: ["/images/wonderloop-hero-og.jpg"]
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
