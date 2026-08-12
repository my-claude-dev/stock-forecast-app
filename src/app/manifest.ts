import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "株価予測アプリ",
    short_name: "株価予測",
    description: "日本株の過去株価と将来予測を表示する個人用アプリ",
    start_url: "/",
    display: "standalone",
    background_color: "#fafafa",
    theme_color: "#0f172a",
    lang: "ja",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icons/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
