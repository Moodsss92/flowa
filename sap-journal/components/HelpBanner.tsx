"use client";

import { useEffect, useState } from "react";
import { Icon } from "./ui/Badges";

const KEY = "sapjournal.help.hidden";
const STEPS = ["Dépose ta capture", "Claude propose T-code, chemin et valeurs", "Écris ce que tu as fait", "Enregistre"];

export function HelpBanner() {
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    try {
      setHidden(localStorage.getItem(KEY) === "1");
    } catch {
      setHidden(false);
    }
  }, []);

  if (hidden) return null;
  return (
    <div className="card relative mb-3 bg-blue/10 p-3 pr-12 dark:bg-blue/20">
      <ol className="flex flex-wrap gap-x-4 gap-y-1.5 text-[14px]">
        {STEPS.map((s, i) => (
          <li key={s} className="flex items-center gap-1.5">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue text-[12px] font-bold text-white">
              {i + 1}
            </span>
            <span>{s}</span>
          </li>
        ))}
      </ol>
      <button
        type="button"
        aria-label="Masquer l'aide"
        onClick={() => {
          setHidden(true);
          try {
            localStorage.setItem(KEY, "1");
          } catch {}
        }}
        className="absolute right-1 top-1 flex h-11 w-11 items-center justify-center text-label3"
      >
        <Icon name="close" className="h-4 w-4" />
      </button>
    </div>
  );
}
