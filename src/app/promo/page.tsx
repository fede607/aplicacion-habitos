import type { Metadata } from "next";
import { Logo } from "@/components/layout/logo";
import { CopyText } from "./copy-text";

export const metadata: Metadata = { title: "Kit para estados", robots: { index: false } };

const CAPTIONS = [
  "Este año me he propuesto no fallar ni un día 🔥 Mi línea de constancia en Year Arc no para de subir: cada día que cumplo mis hábitos, sube. ¿Te animas? 👉 winterarc-2026.vercel.app/w",
  "Así va mi año 👇 Esta línea es mi constancia día a día. Elige tus hábitos y traza la tuya, es gratis 👉 winterarc-2026.vercel.app/w",
  "Me está funcionando esto para entrenar y ser constante 💪 Te hace un plan a tu medida y el primer mes de Pro es gratis 👉 winterarc-2026.vercel.app/w",
];

export default function PromoPage() {
  return (
    <main className="mx-auto grid max-w-3xl gap-8 px-4 py-8">
      <header className="grid gap-2">
        <Logo />
        <h1 className="text-2xl font-black">Kit para estados de WhatsApp</h1>
        <p className="text-sm text-muted">
          Descarga una imagen, súbela a tu estado y pega el texto. El enlace <b>/w</b> cuenta cuánta gente se registra desde WhatsApp.
        </p>
      </header>
      <section className="grid grid-cols-3 gap-3" aria-label="Imágenes">
        {[1, 2, 3].map((v) => (
          <a key={v} href={`/api/promo?v=${v}`} download={`year-arc-estado-${v}.png`} className="grid gap-2 text-center text-sm font-semibold">
            {/* eslint-disable-next-line @next/next/no-img-element -- imagen generada al vuelo */}
            <img src={`/api/promo?v=${v}`} alt={`Diseño ${v} para estado`} className="aspect-[9/16] w-full rounded-2xl border border-border object-cover" loading="lazy" />
            Descargar {v}
          </a>
        ))}
      </section>
      <section className="grid gap-3" aria-label="Textos">
        <h2 className="font-bold">Textos para pegar</h2>
        {CAPTIONS.map((c) => (
          <CopyText key={c} text={c} />
        ))}
      </section>
    </main>
  );
}
