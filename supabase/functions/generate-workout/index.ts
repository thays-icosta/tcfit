import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
// Primary model first; if Google's side is overloaded ("high demand" 503s are
// usually brief spikes), retry it once and then fall back to the next models
// in this list instead of failing the personal's request on the first hiccup.
const GEMINI_MODELS = ["gemini-3.6-flash", "gemini-3.7-flash", "gemini-3.5-flash"];
const ATTEMPT_PLAN = [GEMINI_MODELS[0], GEMINI_MODELS[0], GEMINI_MODELS[1], GEMINI_MODELS[2]];
const TRANSIENT_STATUSES = new Set([429, 500, 502, 503, 504]);

type GeminiResult =
  | { ok: true; json: any }
  | { ok: false; transient: boolean };

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
      console.error(`generate-workout: ${model} respondeu ${res.status} (tentativa ${i + 1}): ${errText.slice(0, 500)}`);
      if (TRANSIENT_STATUSES.has(res.status)) {
        transient = true;
      } else if (res.status !== 404) {
        // 400/401/403 — the request or key itself is wrong; another try or model won't change that.
        return { ok: false, transient: false };
      }
      // 404 on a fallback model (not available for this key) just moves on to the next one.
    } catch (e) {
      console.error(`generate-workout: falha de rede com ${model} (tentativa ${i + 1}):`, e);
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

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    workout_name: { type: "STRING" },
    exercises: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          exercise_name: { type: "STRING" },
          sets: { type: "INTEGER" },
          reps: { type: "STRING" },
          rest_time_seconds: { type: "INTEGER" },
        },
        required: ["exercise_name", "sets", "reps", "rest_time_seconds"],
      },
    },
  },
  required: ["workout_name", "exercises"],
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!GEMINI_API_KEY) {
      console.error("generate-workout: GEMINI_API_KEY não configurada.");
      return json({ error: "GEMINI_API_KEY não configurada nas secrets da função." }, 500);
    }

    const authHeader = req.headers.get("Authorization") || "";
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: userData, error: authError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !userData?.user) {
      return json({ error: "Sessão inválida ou expirada. Saia e entre novamente." }, 401);
    }
    const callerId = userData.user.id;

    const { data: callerRow } = await supabase.from("users").select("role").eq("id", callerId).single();
    if (callerRow?.role !== "personal") {
      return json({ error: "Apenas personais podem gerar treinos com IA." }, 403);
    }

    const { instruction } = await req.json();
    if (!instruction || typeof instruction !== "string" || !instruction.trim()) {
      return json({ error: "Descreva o treino que você quer gerar." }, 400);
    }

    const { data: exerciseRows } = await supabase
      .from("exercises")
      .select("id, name, muscle_group, equipment")
      .or(`personal_id.is.null,personal_id.eq.${callerId}`)
      .order("name");

    const catalog = exerciseRows || [];
    if (catalog.length === 0) {
      return json({ error: "Você ainda não cadastrou nenhum exercício na biblioteca." }, 400);
    }

    const catalogText = catalog
      .map((e: { name: string; muscle_group: string | null; equipment: string | null }) =>
        `- ${e.name} (grupo: ${e.muscle_group || "?"}${e.equipment ? `, equipamento: ${e.equipment}` : ""})`
      )
      .join("\n");

    const systemPrompt =
      "Você é um assistente de um personal trainer que monta fichas de treino. " +
      "Você SOMENTE pode usar exercícios da lista abaixo, copiando o campo 'name' EXATAMENTE como está escrito " +
      "(mesma acentuação e maiúsculas/minúsculas) no campo exercise_name. Nunca invente um exercício que não esteja na lista. " +
      "Escolha uma quantidade de exercícios coerente com o pedido do personal (normalmente entre 4 e 8). " +
      "Sugira um nome curto para a ficha (ex: 'Treino A - Quadríceps'). " +
      "Sets é um número inteiro de séries. Reps é uma faixa em texto (ex: '10-12'). rest_time_seconds é o descanso entre séries em segundos (número inteiro, ex: 60).\n\n" +
      "Exercícios disponíveis:\n" + catalogText;

    const gemini = await callGemini(
      JSON.stringify({
        contents: [{ role: "user", parts: [{ text: instruction }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
          temperature: 0.4,
        },
      }),
      GEMINI_API_KEY,
    );

    if (!gemini.ok) {
      // The raw Gemini error body is only ever logged, never shown to the
      // personal — it's an English JSON blob that tells them nothing useful.
      if (gemini.transient) {
        return json({
          error: "A IA do Google está com muita demanda agora. Tenta de novo em alguns instantes — enquanto isso, você pode montar o treino manualmente.",
          retryable: true,
        }, 503);
      }
      return json({
        error: "Não consegui falar com a IA agora. Você pode montar o treino manualmente enquanto isso, e tentar a IA de novo daqui a pouco.",
      }, 502);
    }

    const geminiJson = gemini.json;
    const content = geminiJson?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!content) {
      console.error("generate-workout: resposta do Gemini sem conteúdo:", JSON.stringify(geminiJson));
      return json({ error: "A IA não retornou uma resposta válida." }, 502);
    }

    let parsed: { workout_name?: string; exercises?: Array<{ exercise_name: string; sets: number; reps: string; rest_time_seconds: number }> };
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      console.error("generate-workout: não foi possível interpretar o JSON da IA:", content, e);
      return json({ error: "Não consegui interpretar a resposta da IA." }, 502);
    }

    const catalogByName = new Map(catalog.map((e: { id: string; name: string }) => [e.name.trim().toLowerCase(), e]));
    const requestedExercises = parsed.exercises || [];
    const matchedExercises = requestedExercises
      .map((item) => {
        const match = catalogByName.get((item.exercise_name || "").trim().toLowerCase());
        if (!match) return null;
        return {
          exercise_id: (match as { id: string }).id,
          exercise_name: (match as { name: string }).name,
          sets: item.sets || 3,
          reps: item.reps || "10-12",
          rest_time_seconds: item.rest_time_seconds || 60,
        };
      })
      .filter(Boolean);

    // requestedExercises.length can be higher than matchedExercises.length
    // when Gemini names an exercise slightly differently than the catalog
    // despite the "copy exactly" instruction — surfaced so the frontend can
    // tell the personal some exercises were silently skipped, instead of
    // them just finding an unexpectedly short ficha later.
    return json({
      workout_name: parsed.workout_name || "Treino Gerado por IA",
      exercises: matchedExercises,
      requested_count: requestedExercises.length,
    });
  } catch (e) {
    console.error("generate-workout: erro inesperado:", e);
    return json({ error: String(e) }, 500);
  }
});
