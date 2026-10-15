import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  RESPONSE_SCHEMA_ANALYZE,
  buildSystemPrompt,
  buildAnalyzeUserText,
  sanitizeAnalysis,
  validatePayload,
} from "./logic.ts";

// AI copilot for the personal. One function, one `action` per feature, so the
// student-context contract lives in one place. Today: `analyze_workout`
// ("Analisar Treino"). The app builds the student context (screens/aiContext.js,
// no identifiers in it) and sends it with the ficha; this function only checks
// the caller is a personal, talks to Gemini and re-validates what comes back.
// It never writes to the database — applying a suggestion is the app's job,
// after the personal clicks it.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
// Same retry/fallback plan as generate-workout: Google's "high demand" 503s
// are usually brief spikes.
const GEMINI_MODELS = ["gemini-3.6-flash", "gemini-3.7-flash", "gemini-3.5-flash"];
const ATTEMPT_PLAN = [GEMINI_MODELS[0], GEMINI_MODELS[0], GEMINI_MODELS[1], GEMINI_MODELS[2]];
const TRANSIENT_STATUSES = new Set([429, 500, 502, 503, 504]);

type GeminiResult = { ok: true; json: any } | { ok: false; transient: boolean };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function callGemini(body: string, apiKey: string): Promise<GeminiResult> {
  let transient = false;
  for (let i = 0; i < ATTEMPT_PLAN.length; i++) {
    const model = ATTEMPT_PLAN[i];
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        { method: "POST", headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" }, body },
      );
      if (res.ok) return { ok: true, json: await res.json() };

      const errText = await res.text();
      console.error(`ai-copilot: ${model} respondeu ${res.status} (tentativa ${i + 1}): ${errText.slice(0, 500)}`);
      if (TRANSIENT_STATUSES.has(res.status)) {
        transient = true;
      } else if (res.status !== 404) {
        return { ok: false, transient: false };
      }
    } catch (e) {
      console.error(`ai-copilot: falha de rede com ${model} (tentativa ${i + 1}):`, e);
      transient = true;
    }
    if (i < ATTEMPT_PLAN.length - 1) await sleep(i === 0 ? 1500 : 700);
  }
  return { ok: false, transient };
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!GEMINI_API_KEY) {
      console.error("ai-copilot: GEMINI_API_KEY não configurada.");
      return json({ error: "A IA não está configurada no servidor." }, 500);
    }

    const authHeader = req.headers.get("Authorization") || "";
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: userData, error: authError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !userData?.user) {
      return json({ error: "Sessão inválida ou expirada. Saia e entre novamente." }, 401);
    }
    const { data: callerRow } = await supabase.from("users").select("role").eq("id", userData.user.id).single();
    if (callerRow?.role !== "personal") {
      return json({ error: "Apenas personais podem usar o copiloto de IA." }, 403);
    }

    const body = await req.json().catch(() => null);
    const payload = validatePayload(body);
    if (!payload.ok) return json({ error: payload.error }, 400);

    const gemini = await callGemini(
      JSON.stringify({
        contents: [{ role: "user", parts: [{ text: buildAnalyzeUserText(payload.context, payload.ficha) }] }],
        systemInstruction: { parts: [{ text: buildSystemPrompt() }] },
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA_ANALYZE,
          temperature: 0.3,
        },
      }),
      GEMINI_API_KEY,
    );

    if (!gemini.ok) {
      if (gemini.transient) {
        return json({
          error: "A IA do Google está com muita demanda agora. Tenta de novo em alguns instantes.",
          retryable: true,
        }, 503);
      }
      return json({ error: "Não consegui falar com a IA agora. Tenta de novo daqui a pouco." }, 502);
    }

    const content = gemini.json?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!content) {
      console.error("ai-copilot: resposta do Gemini sem conteúdo.");
      return json({ error: "A IA não retornou uma resposta válida." }, 502);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch (_e) {
      console.error("ai-copilot: JSON da IA inválido.");
      return json({ error: "Não consegui interpretar a resposta da IA." }, 502);
    }

    const objetivo = typeof payload.context?.perfil?.objetivo === "string" ? payload.context.perfil.objetivo : null;
    return json({ analysis: sanitizeAnalysis(parsed, payload.ficha, { objetivo }) });
  } catch (e) {
    console.error("ai-copilot: erro inesperado:", e);
    return json({ error: "Algo deu errado. Tenta de novo em instantes." }, 500);
  }
});
