"use client";

import { useEffect, useState, type FormEvent } from "react";
import { getSupabase } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("erreur")) {
      setState("error");
      setMessage("Lien expiré ou déjà utilisé. Demande un nouveau lien.");
    }
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setState("sending");
    const { error } = await getSupabase().auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setState("error");
      setMessage(error.message);
    } else {
      setState("sent");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-[400px]">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[16px] bg-blue text-white shadow-pop">
            <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" aria-hidden>
              <path d="M6 7h12M6 12h12M6 17h7" />
            </svg>
          </div>
          <h1 className="text-[28px] font-bold tracking-tight">Journal SAP</h1>
          <p className="mt-1 text-[15px] text-label3">Philo Televisions · S/4HANA MM/SD</p>
        </div>

        {state === "sent" ? (
          <div className="card p-5 text-center">
            <p className="text-[17px] font-semibold">Vérifie ta boîte mail</p>
            <p className="mt-1 text-[15px] text-label3">
              Un lien de connexion a été envoyé à <span className="text-label">{email}</span>.
            </p>
            <button type="button" className="btn-plain mt-3" onClick={() => setState("idle")}>
              Utiliser une autre adresse
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <div className="card p-1">
              <label htmlFor="email" className="sr-only">
                Adresse e-mail
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                placeholder="prenom@exemple.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-[12px] bg-transparent px-4 py-3 text-[17px] outline-none placeholder:text-label3"
              />
            </div>
            <button type="submit" disabled={state === "sending" || !email} className="btn-blue w-full">
              {state === "sending" ? "Envoi…" : "Recevoir un lien magique"}
            </button>
            {state === "error" && (
              <p role="alert" className="px-2 text-center text-[14px] text-red">
                {message}
              </p>
            )}
            <p className="px-4 text-center text-[13px] text-label3">
              Pas de mot de passe : clique sur le lien reçu par e-mail pour te connecter.
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
