import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MengSign",
    short_name: "MengSign",
    description: "国科大课程与签到",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f5f6f8",
    theme_color: "#167d74",
    lang: "zh-CN",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
