"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { staffSetReviewApproved } from "@/app/actions/reviews";
import { Stars } from "@/components/reviews/social-proof";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export type StaffReview = { id: string; username: string; name: string; rating: number; body: string; allowPublic: boolean; approved: boolean };

export function ReviewsManager({ reviews }: { reviews: StaffReview[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (!reviews.length) return <p className="text-sm text-muted">Aún no hay opiniones. Se piden solas a la semana de usar la app.</p>;
  const set = (id: string, approved: boolean) =>
    start(async () => {
      const res = await staffSetReviewApproved({ reviewId: id, approved });
      if (!res.ok) return void toast.error(res.error);
      toast.success(approved ? "Publicada en la web" : "Retirada de la web");
      router.refresh();
    });
  return (
    <ul className="grid gap-2">
      {reviews.map((r) => (
        <li key={r.id} className="grid gap-2 rounded-2xl border border-border p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Stars value={r.rating} />
            <span className="text-sm font-semibold">{r.name}</span>
            <span className="text-xs text-muted">@{r.username}</span>
            {r.approved ? <Badge tone="primary">En la web</Badge> : null}
            {!r.allowPublic ? <Badge>Privada</Badge> : null}
          </div>
          {r.body ? <p className="text-sm">{r.body}</p> : <p className="text-sm text-muted">(sin texto)</p>}
          {r.allowPublic && r.body && r.rating >= 4 ? (
            <Button size="sm" variant={r.approved ? "outline" : "primary"} disabled={pending} onClick={() => set(r.id, !r.approved)} className="justify-self-start">
              {r.approved ? "Quitar de la web" : "Publicar en la web"}
            </Button>
          ) : (
            <p className="text-xs text-muted">{r.allowPublic ? "Sólo se publican opiniones de 4-5 estrellas con texto." : "No ha dado permiso para publicarla."}</p>
          )}
        </li>
      ))}
    </ul>
  );
}
