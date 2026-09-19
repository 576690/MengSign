import type { Metadata, Viewport } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "MengSign · 轻松签到，专注当下",
  description: "国科大今日课程、快捷签到与动态二维码。",
  applicationName: "MengSign",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "MengSign" },
  icons: { icon: "/icon.svg", apple: "/icons/apple-touch-icon.png" },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f6f8" },
    { media: "(prefers-color-scheme: dark)", color: "#101719" },
  ],
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('mengsign:theme')||'system';document.documentElement.dataset.theme=t==='system'?(matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light'):t}catch(e){}`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
