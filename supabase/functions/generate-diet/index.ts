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
      console.error(`generate-diet: ${model} respondeu ${res.status} (tentativa ${i + 1}): ${errText.slice(0, 500)}`);
      if (TRANSIENT_STATUSES.has(res.status)) {
        transient = true;
      } else if (res.status !== 404) {
        // 400/401/403 — the request or key itself is wrong; another try or model won't change that.
        return { ok: false, transient: false };
      }
      // 404 on a fallback model (not available for this key) just moves on to the next one.
    } catch (e) {
      console.error(`generate-diet: falha de rede com ${model} (tentativa ${i + 1}):`, e);
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
    goal_kcal: { type: "INTEGER", nullable: true },
    goal_protein_g: { type: "INTEGER", nullable: true },
    goal_carbs_g: { type: "INTEGER", nullable: true },
    goal_fat_g: { type: "INTEGER", nullable: true },
    meals: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          name: { type: "STRING" },
          meal_time: { type: "STRING", nullable: true },
          foods: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                food_name: { type: "STRING" },
                quantity_g: { type: "NUMBER", nullable: true },
                calories_kcal: { type: "NUMBER", nullable: true },
                protein_g: { type: "NUMBER", nullable: true },
                carbs_g: { type: "NUMBER", nullable: true },
                fat_g: { type: "NUMBER", nullable: true },
              },
              required: ["food_name", "quantity_g", "calories_kcal", "protein_g", "carbs_g", "fat_g"],
            },
          },
        },
        required: ["name", "meal_time", "foods"],
      },
    },
  },
  required: ["goal_kcal", "goal_protein_g", "goal_carbs_g", "goal_fat_g", "meals"],
};

const SYSTEM_PROMPT =
  "Você é um assistente de um nutricionista/personal trainer que monta planos alimentares. " +
  "Com base no pedido do profissional, sugira refeições realistas (ex: Café da manhã, Almoço, Lanche, Jantar) " +
  "com alimentos e quantidades em gramas, e uma estimativa razoável de calorias e macros (proteína, carboidrato, gordura) " +
  "por alimento, usando seu conhecimento nutricional geral. " +
  "Também sugira metas diárias totais (goal_kcal, goal_protein_g, goal_carbs_g, goal_fat_g) coerentes com a soma das refeições e o objetivo descrito. " +
  "Se o pedido não der informação suficiente pra estimar algum valor, use null nesse campo. " +
  "meal_time é um horário aproximado em texto (ex: '08:00') ou null se não fizer sentido.";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!GEMINI_API_KEY) {
      console.error("generate-diet: GEMINI_API_KEY não configurada.");
      return json({ error: "GEMINI_API_KEY não configurada nas secrets da função." }, 500);
    }

    const authHeader = req.headers.get("Authorization") || "";
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: userData, error: authError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !userData?.user) {
      return json({ error: "Sessão inválida ou expirada. Saia e entre novamente." }, 401);
    }

    const { data: callerRow } = await supabase.from("users").select("role").eq("id", userData.user.id).single();
    if (callerRow?.role !== "personal") {
      return json({ error: "Apenas personais podem gerar dietas com IA." }, 403);
    }

    const { instruction } = await req.json();
    if (!instruction || typeof instruction !== "string" || !instruction.trim()) {
      return json({ error: "Descreva o plano alimentar que você quer gerar." }, 400);
    }

    const gemini = await callGemini(
      JSON.stringify({
        contents: [{ role: "user", parts: [{ text: instruction }] }],
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
          temperature: 0.5,
        },
      }),
      GEMINI_API_KEY,
    );

    if (!gemini.ok) {
      // The raw Gemini error body is only ever logged, never shown — it's an
      // English JSON blob that tells the personal nothing useful.
      if (gemini.transient) {
        return json({
          error: "A IA do Google está com muita demanda agora. Tenta de novo em alguns instantes — enquanto isso, você pode montar a dieta manualmente.",
          retryable: true,
        }, 503);
      }
      return json({
        error: "Não consegui falar com a IA agora. Você pode montar a dieta manualmente enquanto isso, e tentar a IA de novo daqui a pouco.",
      }, 502);
    }

    const geminiJson = gemini.json;
    const content = geminiJson?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!content) {
      console.error("generate-diet: resposta do Gemini sem conteúdo:", JSON.stringify(geminiJson));
      return json({ error: "A IA não retornou uma resposta válida." }, 502);
    }

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      console.error("generate-diet: não foi possível interpretar o JSON da IA:", content, e);
      return json({ error: "Não consegui interpretar a resposta da IA." }, 502);
    }

    return json(parsed);
  } catch (e) {
    console.error("generate-diet: erro inesperado:", e);
    return json({ error: "Algo deu errado. Tenta de novo em instantes." }, 500);
  }
});
