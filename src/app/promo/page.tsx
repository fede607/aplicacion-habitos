import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/data/session";
import { Logo } from "@/components/layout/logo";
import { CopyText } from "./copy-text";

export const metadata: Metadata = { title: "Kit para estados", robots: { index: false } };

const CAPTIONS = [
  "🚨 Sólo 90 plazas. Abro Year Arc, la app con la que llevo mis hábitos y mi entreno, y cuando se llenen se cierra el registro. Gratis y con 1 mes de Pro de regalo. Coge la tuya 👉 winterarc-2026.vercel.app/w",
  "Quedan pocas plazas 🔥 Sólo entran 90 personas en Year Arc: tus hábitos, tu entreno y tu año pintado día a día. Si la quieres, que sea hoy 👉 winterarc-2026.vercel.app/w",
  "¿Este año sí? 💪 Year Arc te hace un plan a tu medida y te avisa para que no falles ni un día. Sólo 90 plazas y no se va a volver a abrir pronto 👉 winterarc-2026.vercel.app/w",
];

export default async function PromoPage() {
  // Sólo el staff reparte la app: el kit de anuncios no es público.
  const { supabase } = await requireSession();
  const { data: isStaff } = await supabase.rpc("am_i_staff");
  if (!isStaff) notFound();
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
