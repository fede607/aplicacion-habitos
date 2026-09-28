import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Winter Arc",
    short_name: "Winter Arc",
    description: "Hábitos, entrenamiento y constancia con tus amigos.",
    start_url: "/today",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#060a12",
    theme_color: "#060a12",
    lang: "es",
    categories: ["health", "fitness", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Hoy", url: "/today" },
      { name: "Nuevo entrenamiento", url: "/workouts/new" },
    ],
  };
}
