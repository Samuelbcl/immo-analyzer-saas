"use client";

import { useState } from "react";

const SLOTS = [
  { key: "facade", label: "Façade" },
  { key: "cuisine", label: "Cuisine" },
  { key: "salon", label: "Salon" },
  { key: "chambre", label: "Chambre" },
  { key: "salle_de_bain", label: "Salle de bain" },
  { key: "jardin", label: "Jardin / Extérieur" },
] as const;

export function PhotoUploader() {
  const [previews, setPreviews] = useState<Record<string, string | null>>({});

  function onSelect(slot: string, file: File | null) {
    if (!file) {
      setPreviews((prev) => ({ ...prev, [slot]: null }));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setPreviews((prev) => ({ ...prev, [slot]: reader.result as string }));
    };
    reader.readAsDataURL(file);
  }

  const filledCount = Object.values(previews).filter(Boolean).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {SLOTS.map((s) => (
          <PhotoSlot
            key={s.key}
            label={s.label}
            preview={previews[s.key] ?? null}
            onSelect={(f) => onSelect(s.key, f)}
          />
        ))}
      </div>

      {filledCount > 0 && (
        <div className="p-3 bg-secondary border border-border rounded-md text-sm">
          <strong>{filledCount}</strong> photo{filledCount > 1 ? "s" : ""} chargée
          {filledCount > 1 ? "s" : ""} en mémoire navigateur.{" "}
          <span className="text-muted-foreground">
            Quand Supabase Storage sera branché, un bouton &quot;Sauvegarder&quot;
            apparaîtra ici et tes photos seront persistées et intégrées au
            rapport.
          </span>
        </div>
      )}
    </div>
  );
}

function PhotoSlot({
  label,
  preview,
  onSelect,
}: {
  label: string;
  preview: string | null;
  onSelect: (file: File | null) => void;
}) {
  return (
    <label className="relative aspect-[4/3] border-2 border-dashed border-border rounded-md flex items-center justify-center cursor-pointer hover:border-primary transition-colors overflow-hidden bg-secondary/30">
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        onChange={(e) => onSelect(e.target.files?.[0] ?? null)}
      />
      {preview ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt={label}
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent text-white text-xs p-2 font-medium">
            {label}
          </div>
        </>
      ) : (
        <div className="text-center px-3">
          <div className="text-2xl text-muted-foreground mb-1">+</div>
          <div className="text-xs font-medium">{label}</div>
          <div className="text-[10px] text-muted-foreground mt-1">
            PNG · JPG · WEBP
          </div>
        </div>
      )}
    </label>
  );
}
