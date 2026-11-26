"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase/client";
import type { Member, MemberName } from "@/lib/types";

/** Membres de l'équipe (temps réel) + profil de l'utilisateur courant. */
export function useMembers(userId: string | undefined) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    const supabase = getSupabase();
    let cancelled = false;

    supabase
      .from("members")
      .select("*")
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) setError(error.message);
        setMembers((data as Member[]) ?? []);
        setLoaded(true);
      });

    const channel = supabase
      .channel("members-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "members" }, (payload) => {
        setMembers((prev) => {
          if (payload.eventType === "DELETE") return prev.filter((m) => m.id !== (payload.old as Member).id);
          const row = payload.new as Member;
          return [...prev.filter((m) => m.id !== row.id), row];
        });
      })
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const me = members.find((m) => m.id === userId) ?? null;

  const chooseName = useCallback(
    async (name: MemberName) => {
      if (!userId) return;
      const { data, error } = await getSupabase()
        .from("members")
        .upsert({ id: userId, name }, { onConflict: "id" })
        .select()
        .single();
      if (error) throw new Error(error.message);
      const row = data as Member;
      setMembers((prev) => [...prev.filter((m) => m.id !== row.id), row]);
    },
    [userId],
  );

  const nameOf = useCallback(
    (id: string | null | undefined) => (id ? members.find((m) => m.id === id)?.name : undefined),
    [members],
  );

  return { members, me, loaded, error, chooseName, nameOf };
}
