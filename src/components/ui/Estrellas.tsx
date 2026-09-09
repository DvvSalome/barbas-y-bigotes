import { StarIcon } from "@/components/icons";

// Calificación 1–5 con el ícono del set, en vez de "★★★☆☆" escrito como texto
// (que cada teléfono dibuja con otra forma y no se puede colorear a medias).
export function Estrellas({ score, max = 5, className = "h-3.5 w-3.5" }: { score: number; max?: number; className?: string }) {
  const n = Math.max(0, Math.min(max, Math.round(score)));
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={`${n} de ${max} estrellas`}>
      {Array.from({ length: max }, (_, i) => (
        <StarIcon key={i} className={`${className} ${i < n ? "fill-current text-warn" : "text-line"}`} />
      ))}
    </span>
  );
}
