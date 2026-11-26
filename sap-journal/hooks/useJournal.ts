"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabase } from "@/lib/supabase/client";
import { removeFiles } from "@/lib/storage";
import { compareSteps } from "@/lib/numbering";
import type { Capture, DraftCapture, Step, StepFields } from "@/lib/types";

function upsert<T extends { id: string }>(list: T[], row: T): T[] {
  const i = list.findIndex((x) => x.id === row.id);
  if (i === -1) return [...list, row];
  const next = list.slice();
  next[i] = row;
  return next;
}

/** Étapes + captures, synchronisées en temps réel avec Supabase. */
export function useJournal(enabled: boolean) {
  const [steps, setSteps] = useState<Step[]>([]);
  const [captures, setCaptures] = useState<Capture[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(false);

  const reload = useCallback(async () => {
    const supabase = getSupabase();
    const [s, c] = await Promise.all([
      supabase.from("steps").select("*"),
      supabase.from("captures").select("*").order("position"),
    ]);
    if (s.error || c.error) setError((s.error ?? c.error)!.message);
    else setError(null);
    setSteps((s.data as Step[]) ?? []);
    setCaptures((c.data as Capture[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const supabase = getSupabase();
    reload();

    const channel = supabase
      .channel("journal-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "steps" }, (p) => {
        if (p.eventType === "DELETE") {
          const id = (p.old as Partial<Step>).id;
          setSteps((prev) => prev.filter((s) => s.id !== id));
          setCaptures((prev) => prev.filter((c) => c.step_id !== id));
        } else {
          setSteps((prev) => upsert(prev, p.new as Step));
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "captures" }, (p) => {
        if (p.eventType === "DELETE") {
          const id = (p.old as Partial<Capture>).id;
          setCaptures((prev) => prev.filter((c) => c.id !== id));
        } else {
          setCaptures((prev) => upsert(prev, p.new as Capture));
        }
      })
      .subscribe((status) => {
        setLive(status === "SUBSCRIBED");
        // Après une reconnexion, on resynchronise pour ne rien rater.
        if (status === "SUBSCRIBED") reload();
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, reload]);

  const sortedSteps = useMemo(() => steps.slice().sort(compareSteps), [steps]);

  const capturesByStep = useMemo(() => {
    const map = new Map<string, Capture[]>();
    for (const c of captures) {
      const list = map.get(c.step_id) ?? [];
      list.push(c);
      map.set(c.step_id, list);
    }
    map.forEach((list) => list.sort((a, b) => a.position - b.position));
    return map;
  }, [captures]);

  // ---------- Mutations ----------

  /** Crée ou met à jour une fiche puis synchronise ses captures. */
  const saveStep = useCallback(
    async (id: string, fields: StepFields, drafts: DraftCapture[], isNew: boolean): Promise<Step> => {
      const supabase = getSupabase();
      const q = isNew
        ? supabase.from("steps").insert({ id, ...fields }).select().single()
        : supabase.from("steps").update(fields).eq("id", id).select().single();
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      const step = data as Step;
      setSteps((prev) => upsert(prev, step));

      // Captures : suppression, mise à jour (légende / ordre), ajout
      const existing = captures.filter((c) => c.step_id === id);
      const keptIds = new Set(drafts.filter((d) => d.id).map((d) => d.id!));
      const removed = existing.filter((c) => !keptIds.has(c.id));
      if (removed.length) {
        const { error: delErr } = await supabase.from("captures").delete().in("id", removed.map((c) => c.id));
        if (delErr) throw new Error(delErr.message);
        await removeFiles(removed.map((c) => c.path));
        setCaptures((prev) => prev.filter((c) => !removed.some((r) => r.id === c.id)));
      }

      const rows = drafts.map((d, position) => ({
        ...(d.id ? { id: d.id } : {}),
        step_id: id,
        path: d.path,
        legende: d.legende,
        position,
      }));
      const changed = rows.filter((r) => {
        if (!("id" in r)) return true;
        const old = existing.find((c) => c.id === r.id);
        return !old || old.legende !== r.legende || old.position !== r.position;
      });
      const toUpdate = changed.filter((r) => "id" in r);
      const toInsert = changed.filter((r) => !("id" in r));
      if (toUpdate.length) {
        const { data: up, error: upErr } = await supabase.from("captures").upsert(toUpdate).select();
        if (upErr) throw new Error(upErr.message);
        setCaptures((prev) => (up as Capture[]).reduce(upsert, prev));
      }
      if (toInsert.length) {
        const { data: ins, error: insErr } = await supabase.from("captures").insert(toInsert).select();
        if (insErr) throw new Error(insErr.message);
        setCaptures((prev) => (ins as Capture[]).reduce(upsert, prev));
      }
      return step;
    },
    [captures],
  );

  const updateStatut = useCallback(async (id: string, statut: Step["statut"]) => {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, statut } : s)));
    const { data, error } = await getSupabase().from("steps").update({ statut }).eq("id", id).select().single();
    if (error) throw new Error(error.message);
    setSteps((prev) => upsert(prev, data as Step));
  }, []);

  const deleteStep = useCallback(
    async (id: string) => {
      const paths = captures.filter((c) => c.step_id === id).map((c) => c.path);
      const { error } = await getSupabase().from("steps").delete().eq("id", id);
      if (error) throw new Error(error.message);
      setSteps((prev) => prev.filter((s) => s.id !== id));
      setCaptures((prev) => prev.filter((c) => c.step_id !== id));
      await removeFiles(paths);
    },
    [captures],
  );

  /** Ajoute des captures déjà envoyées dans le Storage à une fiche existante. */
  const appendCaptures = useCallback(
    async (stepId: string, paths: string[]) => {
      const start = captures.filter((c) => c.step_id === stepId).reduce((m, c) => Math.max(m, c.position + 1), 0);
      const rows = paths.map((path, i) => ({ step_id: stepId, path, legende: "", position: start + i }));
      const { data, error } = await getSupabase().from("captures").insert(rows).select();
      if (error) {
        await removeFiles(paths);
        throw new Error(error.message);
      }
      setCaptures((prev) => (data as Capture[]).reduce(upsert, prev));
    },
    [captures],
  );

  return {
    steps: sortedSteps,
    captures,
    capturesByStep,
    loading,
    error,
    live,
    reload,
    saveStep,
    updateStatut,
    deleteStep,
    appendCaptures,
  };
}
