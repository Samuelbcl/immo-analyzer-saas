"use client";

import { useCallback, useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";

const SLOTS = [
  { key: "facade", label: "Façade" },
  { key: "cuisine", label: "Cuisine" },
  { key: "salon", label: "Salon" },
  { key: "chambre", label: "Chambre" },
  { key: "salle_de_bain", label: "Salle de bain" },
  { key: "jardin", label: "Jardin / Extérieur" },
] as const;

const BUCKET = "renovation-photos";

type SlotState = {
  url: string | null;
  uploading: boolean;
  error: string | null;
};

export function PhotoUploader({ analysisId }: { analysisId: string }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [slots, setSlots] = useState<Record<string, SlotState>>(() =>
    Object.fromEntries(
      SLOTS.map((s) => [s.key, { url: null, uploading: false, error: null }]),
    ),
  );

  // Load existing photos at mount
  const loadExisting = useCallback(
    async (uid: string) => {
      const supabase = createClient();
      const folder = `${uid}/${analysisId}`;
      const { data } = await supabase.storage.from(BUCKET).list(folder);
      if (!data) return;

      for (const file of data) {
        const slot = SLOTS.find((s) => file.name.startsWith(s.key));
        if (!slot) continue;
        const path = `${folder}/${file.name}`;
        const { data: signed } = await supabase.storage
          .from(BUCKET)
          .createSignedUrl(path, 3600);
        if (signed?.signedUrl) {
          setSlots((prev) => ({
            ...prev,
            [slot.key]: { url: signed.signedUrl, uploading: false, error: null },
          }));
        }
      }
    },
    [analysisId],
  );

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserId(user.id);
        loadExisting(user.id);
      }
    });
  }, [loadExisting]);

  async function onSelect(slot: string, file: File | null) {
    if (!file || !userId) return;
    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    if (!["png", "jpg", "jpeg", "webp"].includes(ext)) {
      setSlots((p) => ({
        ...p,
        [slot]: { ...p[slot], error: "Format non supporté" },
      }));
      return;
    }
    setSlots((p) => ({
      ...p,
      [slot]: { ...p[slot], uploading: true, error: null },
    }));

    const supabase = createClient();
    const path = `${userId}/${analysisId}/${slot}.${ext}`;

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { upsert: true, contentType: file.type });

    if (error) {
      setSlots((p) => ({
        ...p,
        [slot]: { ...p[slot], uploading: false, error: error.message },
      }));
      return;
    }

    const { data: signed } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, 3600);

    setSlots((p) => ({
      ...p,
      [slot]: {
        url: signed?.signedUrl ?? null,
        uploading: false,
        error: null,
      },
    }));
  }

  const filledCount = Object.values(slots).filter((s) => s.url).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {SLOTS.map((s) => (
          <PhotoSlot
            key={s.key}
            label={s.label}
            state={slots[s.key]}
            onSelect={(f) => onSelect(s.key, f)}
            disabled={!userId}
          />
        ))}
      </div>

      <div className="flex items-center gap-2 text-sm">
        <span className="size-2 rounded-full bg-primary" />
        <span className="text-muted-foreground">
          <strong className="text-foreground">{filledCount}</strong> /{" "}
          {SLOTS.length} photos sauvegardées sur Supabase Storage (chiffrées,
          accessibles uniquement par toi)
        </span>
      </div>
    </div>
  );
}

function PhotoSlot({
  label,
  state,
  onSelect,
  disabled,
}: {
  label: string;
  state: SlotState;
  onSelect: (file: File | null) => void;
  disabled?: boolean;
}) {
  return (
    <label
      className={`relative aspect-[4/3] border-2 border-dashed rounded-lg flex items-center justify-center overflow-hidden bg-secondary/30 transition-colors ${
        state.url
          ? "border-primary/30"
          : "border-border hover:border-primary/40"
      } ${disabled || state.uploading ? "cursor-wait opacity-60" : "cursor-pointer"}`}
    >
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        onChange={(e) => onSelect(e.target.files?.[0] ?? null)}
        disabled={disabled || state.uploading}
      />
      {state.url ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={state.url}
            alt={label}
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent text-white text-xs p-2 font-medium flex items-center justify-between">
            <span>{label}</span>
            <span className="text-xs opacity-70">↻ Remplacer</span>
          </div>
        </>
      ) : state.uploading ? (
        <div className="text-center px-3">
          <div className="text-sm text-primary animate-pulse">Upload…</div>
        </div>
      ) : (
        <div className="text-center px-3">
          <div className="text-2xl text-muted-foreground mb-1">+</div>
          <div className="text-xs font-medium">{label}</div>
          <div className="text-[10px] text-muted-foreground mt-1">
            PNG · JPG · WEBP
          </div>
        </div>
      )}
      {state.error && (
        <div className="absolute inset-x-0 bottom-0 bg-destructive text-destructive-foreground text-[10px] p-1 text-center">
          {state.error}
        </div>
      )}
    </label>
  );
}
