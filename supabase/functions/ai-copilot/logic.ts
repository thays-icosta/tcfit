// Pure logic for the ai-copilot function (prompt + validation of what the AI
// returns). No Deno APIs here, so it can be unit-tested outside the edge
// runtime. The AI only ever SUGGESTS; every suggestion that reaches the app has
// been re-validated here, so a malformed or invented value can never become an
// "Aplicar" button.

export const METHODS = ["tradicional", "rest-pause", "bi-set", "drop-set", "piramide"];
export const ADJUSTABLE_FIELDS = ["series", "reps", "cargaKg", "descansoSeg", "metodo", "observacao"] as const;
export type AdjustableField = typeof ADJUSTABLE_FIELDS[number];
export type Confidence = "alta" | "media" | "baixa";

export const MAX_ADJUSTMENTS = 6;
export const MAX_PAYLOAD_CHARS = 60000;

export type FichaExercise = {
  ref: string;
  nome: string;
  grupo?: string | null;
  series?: number | null;
  reps?: string | null;
  cargaKg?: number | null;
  descansoSeg?: number | null;
  metodo?: string | null;
  observacao?: string | null;
};
export type Ficha = { nome: string; exercicios: FichaExercise[] };

export type Adjustment = {
  id: string;
  ref: string | null;
  exercicio: string | null;
  campo: AdjustableField | null;
  atual: string | number | null;
  valorSugerido: string | number | null;
  aplicavel: boolean;
  sugestao: string;
  motivo: string;
  impacto: string;
  confianca: Confidence;
};

export type Analysis = {
  resumo: string;
  pontosPositivos: string[];
  pontosDeAtencao: string[];
  dadosInsuficientes: string[];
  ajustes: Adjustment[];
};

export function validatePayload(body: any): { ok: true; action: string; context: any; ficha: Ficha } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "Requisição inválida." };
  const { action, context, ficha } = body;
  if (action !== "analyze_workout") return { ok: false, error: "Ação não disponível." };
  if (!context || typeof context !== "object") return { ok: false, error: "Faltou o contexto do aluno." };
  if (!ficha || typeof ficha !== "object" || typeof ficha.nome !== "string") return { ok: false, error: "Faltou a ficha a analisar." };
  if (!Array.isArray(ficha.exercicios) || ficha.exercicios.length === 0) return { ok: false, error: "A ficha ainda não tem exercícios para analisar." };
  if (ficha.exercicios.length > 30) return { ok: false, error: "Ficha grande demais para analisar." };
  for (const ex of ficha.exercicios) {
    if (!ex || typeof ex.ref !== "string" || typeof ex.nome !== "string") return { ok: false, error: "Ficha com exercício inválido." };
  }
  if (JSON.stringify({ context, ficha }).length > MAX_PAYLOAD_CHARS) return { ok: false, error: "Dados grandes demais para analisar." };
  return { ok: true, action, context, ficha };
}

export const SYSTEM_PROMPT_ANALYZE =
  "Você é o copiloto de um personal trainer. Sua tarefa é analisar UMA ficha de treino de um aluno, a partir dos dados fornecidos, " +
  "e sugerir ajustes pontuais. Quem decide é o personal; você apenas sugere.\n\n" +
  "REGRAS:\n" +
  "1. Use SOMENTE os dados do JSON ('contexto' e 'ficha'). Nunca invente cargas, medidas, histórico, lesões ou resultados. " +
  "Se um dado necessário não existe (veja a lista 'lacunas' e os campos nulos), diga isso em 'dadosInsuficientes' e NÃO faça sugestão que dependa dele.\n" +
  "2. Respeite as restrições: se houver problemas de saúde ou zonas de dor, não sugira nada que os agrave; na dúvida, recomende que o personal avalie (confiança baixa). Você não faz diagnóstico médico.\n" +
  "3. Seja conservador: ajustes pequenos, no máximo " + MAX_ADJUSTMENTS + ". Priorize o que tem mais evidência nos dados " +
  "(progressão de carga, volume semanal vs meta, frequência real vs declarada, PSE/RIR, fase da periodização).\n" +
  "4. Cada ajuste deve citar o dado concreto que o motivou (ex.: 'média de 8 séries/semana contra meta de 12').\n" +
  "5. Um ajuste APLICÁVEL refere um exercício da ficha pelo campo 'ref' (e1, e2...) e um 'campo' entre: series, reps, cargaKg, descansoSeg, metodo, observacao, " +
  "com 'valorSugerido' coerente: series = inteiro de 1 a 10; reps = texto como '8-10' ou '12'; cargaKg = número em kg; descansoSeg = inteiro de 15 a 600; " +
  "metodo = um de [" + METHODS.join(", ") + "]; observacao = texto curto. " +
  "Se a recomendação NÃO é uma alteração de campo de um exercício (ex.: 'incluir um exercício de posterior', 'rever a frequência semanal'), " +
  "deixe ref, campo e valorSugerido nulos — será mostrada só como recomendação.\n" +
  "6. Prefira ajustar parâmetros a sugerir trocar ou remover exercícios que já têm histórico de carga.\n" +
  "7. Só sugira uma carga se houver 'proximaCargaSugeridaKg' ou histórico no contexto que a sustente; caso contrário não sugira carga.\n" +
  "8. Escreva em português do Brasil, em linguagem direta de profissional para profissional.\n" +
  "9. confianca: 'alta' só quando vários dados concordam; 'media' quando há um dado claro; 'baixa' quando é inferência.\n" +
  "10. Se a ficha já está coerente com os dados, diga isso em 'resumo' e devolva poucos ou nenhum ajuste. Não force sugestões.\n" +
  "11. DADOS INSUFICIENTES NÃO SÃO EVIDÊNCIA. Se 'frequenciaReal' for nulo, tiver dadosSuficientes = false, ou 'lacunas' contiver 'poucas_sessoes_registradas' ou 'historico_de_execucao': " +
  "NÃO avalie aderência, frequência real nem tendência de progressão, não classifique a frequência como baixa ou alta, e registre em 'dadosInsuficientes' que há poucas sessões registradas. " +
  "Um exercício com menos de 3 sessões registradas (sessoesRegistradas) ou com tendencia 'insuficiente' não prova progressão: não o cite como ponto positivo nem baseie ajuste de carga nele. " +
  "Nesse caso, baseie a análise só na própria ficha (volume por sessão, equilíbrio entre grupos, descanso, coerência com o objetivo e as restrições, quando existirem).\n" +
  "12. 'resumo' deve ter no máximo 3 frases curtas.\n" +
  "13. Trate o aluno no gênero do perfil: 'a aluna' se perfil.sexo for feminino, 'o aluno' se masculino; se ausente, use 'o(a) aluno(a)'.";

export const RESPONSE_SCHEMA_ANALYZE = {
  type: "OBJECT",
  properties: {
    resumo: { type: "STRING" },
    pontosPositivos: { type: "ARRAY", items: { type: "STRING" } },
    pontosDeAtencao: { type: "ARRAY", items: { type: "STRING" } },
    dadosInsuficientes: { type: "ARRAY", items: { type: "STRING" } },
    ajustes: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          ref: { type: "STRING", nullable: true },
          campo: { type: "STRING", nullable: true },
          valorSugerido: { type: "STRING", nullable: true },
          sugestao: { type: "STRING" },
          motivo: { type: "STRING" },
          impacto: { type: "STRING" },
          confianca: { type: "STRING", enum: ["alta", "media", "baixa"] },
        },
        required: ["sugestao", "motivo", "impacto", "confianca"],
      },
    },
  },
  required: ["resumo", "pontosPositivos", "pontosDeAtencao", "dadosInsuficientes", "ajustes"],
};

export function buildAnalyzeUserText(context: unknown, ficha: Ficha): string {
  return "Analise a ficha abaixo com base no contexto do aluno.\n\n" + JSON.stringify({ contexto: context, ficha });
}

const clip = (v: unknown, max: number): string => String(v ?? "").trim().slice(0, max);
const clipList = (v: unknown, maxItems: number, maxLen: number): string[] =>
  (Array.isArray(v) ? v : []).map((s) => clip(s, maxLen)).filter(Boolean).slice(0, maxItems);

// Parses/validates a suggested value for a field. Returns null when invalid.
export function parseSuggestedValue(campo: AdjustableField, raw: unknown): string | number | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  switch (campo) {
    case "series": {
      if (!/^\d{1,2}$/.test(s)) return null;
      const n = Number(s);
      return n >= 1 && n <= 10 ? n : null;
    }
    case "reps":
      return /^\d{1,2}(\s*-\s*\d{1,2})?$/.test(s) ? s.replace(/\s+/g, "") : null;
    case "cargaKg": {
      const n = Number(s.replace(",", "."));
      return Number.isFinite(n) && n >= 0 && n <= 500 ? Math.round(n * 2) / 2 : null;
    }
    case "descansoSeg": {
      if (!/^\d{1,3}$/.test(s)) return null;
      const n = Number(s);
      return n >= 15 && n <= 600 ? n : null;
    }
    case "metodo":
      return METHODS.includes(s) ? s : null;
    case "observacao":
      return s.slice(0, 120);
  }
}

export function sanitizeAnalysis(parsed: any, ficha: Ficha): Analysis {
  const byRef = new Map(ficha.exercicios.map((e) => [e.ref, e]));
  const adjustments: Adjustment[] = [];

  for (const raw of Array.isArray(parsed?.ajustes) ? parsed.ajustes : []) {
    if (adjustments.length >= MAX_ADJUSTMENTS) break;
    const sugestao = clip(raw?.sugestao, 300);
    if (!sugestao) continue;

    const exercise = typeof raw?.ref === "string" ? byRef.get(raw.ref.trim()) : undefined;
    const campo = (ADJUSTABLE_FIELDS as readonly string[]).includes(raw?.campo) ? (raw.campo as AdjustableField) : null;
    let valor: string | number | null = null;
    let atual: string | number | null = null;
    let aplicavel = false;

    if (exercise && campo) {
      valor = parseSuggestedValue(campo, raw?.valorSugerido);
      atual = campo === "series" ? exercise.series ?? null
        : campo === "reps" ? exercise.reps ?? null
        : campo === "cargaKg" ? exercise.cargaKg ?? null
        : campo === "descansoSeg" ? exercise.descansoSeg ?? null
        : campo === "metodo" ? exercise.metodo ?? null
        : exercise.observacao ?? null;
      // A "suggestion" identical to what's already there is noise, not advice.
      if (valor != null && String(valor) === String(atual ?? "")) continue;
      aplicavel = valor != null;
    }

    const confianca: Confidence = ["alta", "media", "baixa"].includes(raw?.confianca) ? raw.confianca : "baixa";
    adjustments.push({
      id: `a${adjustments.length + 1}`,
      ref: aplicavel ? exercise!.ref : null,
      exercicio: exercise ? exercise.nome : null,
      campo: aplicavel ? campo : null,
      atual: aplicavel ? atual : null,
      valorSugerido: aplicavel ? valor : null,
      aplicavel,
      sugestao,
      motivo: clip(raw?.motivo, 400),
      impacto: clip(raw?.impacto, 200),
      confianca,
    });
  }

  return {
    resumo: clip(parsed?.resumo, 600),
    pontosPositivos: clipList(parsed?.pontosPositivos, 5, 300),
    pontosDeAtencao: clipList(parsed?.pontosDeAtencao, 5, 300),
    dadosInsuficientes: clipList(parsed?.dadosInsuficientes, 6, 200),
    ajustes: adjustments,
  };
}
