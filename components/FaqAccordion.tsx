"use client";

import { useState } from "react";
import type { Faq } from "@/lib/types";

export function FaqAccordion({ faqs }: { faqs: Faq[] }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="space-y-2">
      {faqs.map((f, i) => (
        <div key={f.id} className="vd-card-flat overflow-hidden">
          <button
            onClick={() => setOpen(open === i ? null : i)}
            className="w-full text-left px-4 py-3 font-semibold flex justify-between gap-3"
            aria-expanded={open === i}
          >
            {f.question}
            <span className="text-brand-400 shrink-0">{open === i ? "−" : "+"}</span>
          </button>
          {open === i && <p className="px-4 pb-4 text-sm vd-muted leading-relaxed">{f.answer}</p>}
        </div>
      ))}
    </div>
  );
}
