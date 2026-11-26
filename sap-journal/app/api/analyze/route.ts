import Anthropic from "@anthropic-ai/sdk";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { BLOCS, matchBloc } from "@/lib/blocs";
import { getAdminSupabase, getServerSupabase } from "@/lib/supabase/server";
import { normalizeTcode, tcodesForPrompt } from "@/lib/tcodes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_IMAGES = 5;
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";

type ImageMediaType = "image/png" | "image/jpeg" | "image/webp" | "image/gif";

const RequestSchema = z.object({
  paths: z
    .array(z.string().min(1).max(500).refine((p) => !p.includes(".."), "Chemin invalide"))
    .min(1, "Aucune capture à analyser.")
    .max(20),
});

/** Champ texte tolérant : null → "", tableau → lignes, nombre → texte. */
const text = z.preprocess((v) => {
  if (v === null || v === undefined) return "";
  if (Array.isArray(v)) return v.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join("\n");
  if (typeof v === "object") {
    return Object.entries(v as Record<string, unknown>)
      .map(([k, val]) => `${k} : ${String(val)}`)
      .join("\n");
  }
  return String(v);
}, z.string().max(8000));

const ResultSchema = z.object({
  tcode: text,
  titre: text,
  chemin: text,
  action: text,
  valeurs: text,
  controle: text,
  bloc: text,
});

function buildPrompt(): string {
  return `Tu aides une équipe de stagiaires SAP S/4HANA (MM/SD) à documenter la configuration du business case Philo Televisions (company codes C2NL et C2BE copiées de 1010, plants Breda, Delft, Brussels, Antwerp, purchasing orgs P2HQ/P2BR/P2BX/P2AN, sales orgs S2NL/S2BE). Voici des captures d'écran SAP GUI ou Fiori d'une étape de configuration. Lis le titre de l'écran, les champs, les valeurs et le message de la barre d'état. Réponds UNIQUEMENT en JSON :
{"tcode":"","titre":"","chemin":"chemin SPRO complet séparé par ' › '","action":"1 à 3 phrases","valeurs":"Champ : valeur, une par ligne","controle":"message visible et sa signification, ou le contrôle à faire ensuite","bloc":"un des blocs de la liste"}.
N'invente rien qui ne soit pas visible ou certain ; laisse la chaîne vide sinon.

Blocs possibles :
${BLOCS.join("\n")}

Chemins de référence :
${tcodesForPrompt()}`;
}

function mediaTypeFor(path: string, blobType: string): ImageMediaType {
  const t = blobType.toLowerCase();
  if (t === "image/png" || t === "image/jpeg" || t === "image/webp" || t === "image/gif") return t;
  const ext = path.split(".").pop()?.toLowerCase();
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  return "image/png";
}

/** Extrait le premier objet JSON d'une réponse (tolère les ```json … ```). */
function extractJson(raw: string): unknown {
  const cleaned = raw.replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("no-json");
  return JSON.parse(cleaned.slice(start, end + 1));
}

function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: NextRequest) {
  // 1. Utilisateur connecté et membre de l'équipe
  const supabase = getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Session expirée : reconnecte-toi.", 401);

  const { data: member } = await supabase.from("members").select("id").eq("id", user.id).maybeSingle();
  if (!member) return fail("Choisis d'abord ton nom dans l'équipe.", 403);

  if (!process.env.ANTHROPIC_API_KEY) {
    return fail("La clé ANTHROPIC_API_KEY n'est pas configurée sur le serveur.", 500);
  }

  // 2. Corps de la requête
  let body: z.infer<typeof RequestSchema>;
  try {
    body = RequestSchema.parse(await request.json());
  } catch {
    return fail("Requête invalide : liste de captures attendue.", 400);
  }
  const paths = body.paths.slice(0, MAX_IMAGES);

  // 3. Téléchargement des captures depuis le Storage privé
  const admin = getAdminSupabase();
  const images: Anthropic.Beta.BetaImageBlockParam[] = [];
  for (const path of paths) {
    const { data, error } = await admin.storage.from("captures").download(path);
    if (error || !data) return fail(`Capture introuvable dans le Storage (${path}).`, 404);
    const buffer = Buffer.from(await data.arrayBuffer());
    if (buffer.byteLength > 5 * 1024 * 1024) {
      return fail("Une capture dépasse 5 Mo : réduis-la avant de l'analyser.", 413);
    }
    images.push({
      type: "image",
      source: { type: "base64", media_type: mediaTypeFor(path, data.type), data: buffer.toString("base64") },
    });
  }

  // 4. Appel à Claude (vision)
  const anthropic = new Anthropic();
  let message: Anthropic.Beta.BetaMessage;
  try {
    message = await anthropic.beta.messages.create(
      {
        model: MODEL,
        max_tokens: 4000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: "medium" },
        messages: [
          {
            role: "user",
            content: [
              ...images,
              { type: "text", text: buildPrompt() },
            ],
          },
        ],
      },
      { signal: request.signal },
    );
  } catch (err) {
    if (request.signal.aborted) return fail("Analyse arrêtée.", 499);
    if (err instanceof Anthropic.RateLimitError) {
      return fail("Trop de demandes à Claude pour le moment : réessaie dans une minute.", 429);
    }
    if (err instanceof Anthropic.AuthenticationError) {
      return fail("Clé API Anthropic invalide côté serveur.", 500);
    }
    if (err instanceof Anthropic.BadRequestError) {
      return fail(`Claude a refusé la requête : ${err.message}`, 400);
    }
    if (err instanceof Anthropic.APIConnectionError) {
      return fail("Impossible de joindre l'API Claude. Vérifie la connexion du serveur.", 502);
    }
    if (err instanceof Anthropic.APIError) {
      return fail(`Erreur de l'API Claude (${err.status ?? "?"}). Réessaie.`, 502);
    }
    return fail("Erreur inattendue pendant l'analyse.", 500);
  }

  if (message.stop_reason === "refusal") {
    return fail("Claude n'a pas pu analyser ces captures. Remplis la fiche à la main.", 422);
  }

  const raw = message.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");

  // 5. Validation zod
  let parsed: z.infer<typeof ResultSchema>;
  try {
    parsed = ResultSchema.parse(extractJson(raw));
  } catch {
    return fail("Réponse de Claude illisible (JSON invalide). Réessaie ou remplis à la main.", 502);
  }

  const result = {
    tcode: normalizeTcode(parsed.tcode),
    titre: parsed.titre.trim(),
    chemin: parsed.chemin.trim(),
    action: parsed.action.trim(),
    valeurs: parsed.valeurs.trim(),
    controle: parsed.controle.trim(),
    bloc: matchBloc(parsed.bloc),
  };

  return NextResponse.json({ result, analyzed: paths.length, skipped: body.paths.length - paths.length });
}
