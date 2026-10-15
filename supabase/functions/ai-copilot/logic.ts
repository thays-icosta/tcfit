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
export const MAX_IMPROVEMENTS = 4;
export const MAX_PAYLOAD_CHARS = 60000;
export const MIN_SESSIONS_FOR_TREND = 3;

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
  fontes: number[];
};

export type Improvement = {
  titulo: string;
  recomendacao: string;
  porQue: string;
  fontes: number[];
  confianca: Confidence;
};

export type Reference = { n: number; id: string; tipo: string; citacao: string; url: string; achado: string };

export type Analysis = {
  resumo: string;
  objetivo: string | null;
  pontosPositivos: string[];
  pontosDeAtencao: string[];
  dadosInsuficientes: string[];
  melhoriasParaObjetivo: Improvement[];
  ajustes: Adjustment[];
  referencias: Reference[];
  fontesVerificadasEm: string;
};

// ---------------------------------------------------------------------------
// Evidence library. The AI may ONLY cite entries from this list (by id); every
// other citation is dropped in sanitizeAnalysis. Models invent plausible-looking
// references, so nothing here comes from the model: each record was checked
// against PubMed (title, authors, journal, year, PMID/DOI) and `achado` is a
// faithful summary of that record's own abstract. To re-check them, run
// `node scripts/verify-evidence-library.mjs`.
// ---------------------------------------------------------------------------
export const EVIDENCE_VERIFIED_ON = "2026-10-15";

export type EvidenceSource = {
  id: string;
  tipo: string;
  citacao: string;
  pmid: string;
  doi: string;
  achado: string;
};

export const EVIDENCE_LIBRARY: EvidenceSource[] = [
  {
    id: "F1",
    tipo: "Posição oficial do ACSM (2026)",
    citacao: "Currier BS, D'Souza AC, Singh MAF, et al. American College of Sports Medicine Position Stand. Resistance Training Prescription for Muscle Function, Hypertrophy, and Physical Performance in Healthy Adults: An Overview of Reviews. Med Sci Sports Exerc. 2026;58(4):851-872.",
    pmid: "41843416",
    doi: "10.1249/MSS.0000000000003897",
    achado: "Atualiza a posição do ACSM de 2009, com base em 137 revisões sistemáticas (>30 mil participantes). O treino resistido melhora força, tamanho muscular, potência e função física. Poucas variáveis da prescrição mudaram os resultados primários: a força foi favorecida por cargas altas (≥80% de 1RM), amplitude completa, 2–3 séries, exercícios no início da sessão e ≥2 sessões/semana; a hipertrofia foi favorecida por volumes maiores (≥10 séries/semana) e sobrecarga excêntrica. Treinar até a falha muscular, tipo de equipamento, tempo sob tensão e periodização não influenciaram os resultados de forma consistente.",
  },
  {
    id: "F2",
    tipo: "Revisão sistemática e metanálise em rede",
    citacao: "Currier BS, Mcleod JC, Banfield L, et al. Resistance training prescription for muscle strength and hypertrophy in healthy adults: a systematic review and Bayesian network meta-analysis. Br J Sports Med. 2023;57(18):1211-1220.",
    pmid: "37414459",
    doi: "10.1136/bjsports-2023-106807",
    achado: "Metanálise em rede (178 estudos para força e 119 para hipertrofia): todas as prescrições foram superiores a não treinar. Cargas altas (>80% de 1RM) maximizaram os ganhos de força; todas as prescrições promoveram hipertrofia de forma comparável, e a de melhor ranqueamento para hipertrofia foi treino de várias séries, com cargas mais altas, 2 vezes por semana.",
  },
  {
    id: "F3",
    tipo: "Revisão sistemática e metanálise",
    citacao: "Schoenfeld BJ, Ogborn D, Krieger JW. Dose-response relationship between weekly resistance training volume and increases in muscle mass: A systematic review and meta-analysis. J Sports Sci. 2017;35(11):1073-1082.",
    pmid: "27433992",
    doi: "10.1080/02640414.2016.1210197",
    achado: "Metanálise (15 estudos): há uma relação dose-resposta graduada entre o volume semanal e o ganho de massa muscular. Cada série semanal adicional por grupo muscular se associou a cerca de 0,37% a mais de ganho, e a diferença entre volumes mais altos e mais baixos foi de cerca de 3,9% de ganho. Na análise por faixas (<5, 5–9 e 10+ séries por músculo) houve apenas uma tendência (p = 0,074).",
  },
  {
    id: "F4",
    tipo: "Revisão sistemática e metanálise",
    citacao: "Schoenfeld BJ, Grgic J, Krieger J. How many times per week should a muscle be trained to maximize muscle hypertrophy? A systematic review and meta-analysis of studies examining the effects of resistance training frequency. J Sports Sci. 2019;37(11):1286-1295.",
    pmid: "30558493",
    doi: "10.1080/02640414.2018.1555906",
    achado: "Metanálise (25 estudos): com o volume semanal igualado, a frequência de treino por grupo muscular não afetou de forma significativa a hipertrofia. Assim, para um mesmo volume, a frequência semanal pode ser escolhida por preferência e organização.",
  },
  {
    id: "F5",
    tipo: "Revisão sistemática e metanálise",
    citacao: "Schoenfeld BJ, Grgic J, Ogborn D, Krieger JW. Strength and Hypertrophy Adaptations Between Low- vs. High-Load Resistance Training: A Systematic Review and Meta-analysis. J Strength Cond Res. 2017;31(12):3508-3523.",
    pmid: "28834797",
    doi: "10.1519/JSC.0000000000002200",
    achado: "Metanálise (21 estudos, com séries levadas à falha muscular): o ganho de força máxima (1RM) foi maior com cargas altas (>60% de 1RM) do que com cargas baixas (≤60%), enquanto a hipertrofia foi semelhante entre as faixas de carga.",
  },
  {
    id: "F6",
    tipo: "Revisão sistemática e metanálise",
    citacao: "Refalo MC, Helms ER, Trexler ET, et al. Influence of Resistance Training Proximity-to-Failure on Skeletal Muscle Hypertrophy: A Systematic Review with Meta-analysis. Sports Med. 2023;53(3):649-665.",
    pmid: "36334240",
    doi: "10.1007/s40279-022-01784-y",
    achado: "Metanálise: não há evidência de que treinar até a falha muscular seja superior a parar antes dela para a hipertrofia (vantagem trivial ou nula, dependendo da definição de falha), o que sugere uma relação não linear entre a proximidade da falha e a hipertrofia.",
  },
  {
    id: "F7",
    tipo: "Revisão sistemática e metanálise bayesiana",
    citacao: "Singer A, Wolf M, Generoso L, et al. Give it a rest: a systematic review with Bayesian meta-analysis on the effect of inter-set rest interval duration on muscle hypertrophy. Front Sports Act Living. 2024.",
    pmid: "39205815",
    doi: "10.3389/fspor.2024.1429789",
    achado: "Metanálise bayesiana: possível pequeno benefício para a hipertrofia com descansos entre séries acima de 60 s; não houve diferença apreciável acima de cerca de 90 s.",
  },
  {
    id: "F8",
    tipo: "Revisão sistemática e metanálise",
    citacao: "Morton RW, Murphy KT, McKellar SR, et al. A systematic review, meta-analysis and meta-regression of the effect of protein supplementation on resistance training-induced gains in muscle mass and strength in healthy adults. Br J Sports Med. 2018;52(6):376-384.",
    pmid: "28698222",
    doi: "10.1136/bjsports-2017-097608",
    achado: "Metanálise (49 estudos, 1.863 participantes): a suplementação de proteína aumentou a força e a massa livre de gordura durante o treino resistido em adultos saudáveis. Com a suplementação, ingestões totais acima de cerca de 1,6 g/kg/dia não trouxeram ganho adicional de massa livre de gordura; o efeito foi menor com o aumento da idade e maior em pessoas treinadas.",
  },
  {
    id: "F9",
    tipo: "Posição oficial do ACSM (2009)",
    citacao: "Donnelly JE, Blair SN, Jakicic JM, et al. American College of Sports Medicine Position Stand. Appropriate physical activity intervention strategies for weight loss and prevention of weight regain for adults. Med Sci Sports Exerc. 2009;41(2):459-471.",
    pmid: "19127177",
    doi: "10.1249/MSS.0b013e3181949333",
    achado: "150–250 min/semana de atividade de intensidade moderada previnem o ganho de peso e geram apenas perda de peso modesta; mais de 250 min/semana se associam a perda de peso clinicamente significativa. O treino de força não aumenta a perda de peso, mas pode aumentar a massa livre de gordura e a perda de gordura.",
  },
  {
    id: "F10",
    tipo: "Posição oficial do ACSM (2011)",
    citacao: "Garber CE, Blissmer B, Deschenes MR, et al. American College of Sports Medicine position stand. Quantity and quality of exercise for developing and maintaining cardiorespiratory, musculoskeletal, and neuromotor fitness in apparently healthy adults: guidance for prescribing exercise. Med Sci Sports Exerc. 2011;43(7):1334-1359.",
    pmid: "21694556",
    doi: "10.1249/MSS.0b013e318213fefb",
    achado: "Adultos devem fazer exercícios de força para cada grupo muscular principal em 2–3 dias/semana, além de exercício neuromotor e de flexibilidade (≥2 dias/semana). O programa deve ser ajustado ao estado de saúde, às respostas individuais e aos objetivos; a progressão gradual de intensidade e volume pode reduzir riscos, e estratégias comportamentais e exercício prazeroso melhoram a adesão.",
  },
  {
    id: "F11",
    tipo: "Diretriz da OMS (2020)",
    citacao: "Bull FC, Al-Ansari SS, Biddle S, et al. World Health Organization 2020 guidelines on physical activity and sedentary behaviour. Br J Sports Med. 2020;54(24):1451-1462.",
    pmid: "33239350",
    doi: "10.1136/bjsports-2020-102955",
    achado: "Adultos devem fazer 150–300 min/semana de atividade aeróbica de intensidade moderada (ou 75–150 min de intensidade vigorosa, ou uma combinação equivalente) e atividades regulares de fortalecimento muscular, além de reduzir o comportamento sedentário.",
  },
];

export const pubmedUrl = (pmid: string) => `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`;

export type Payload =
  | { ok: true; action: "analyze_workout"; context: any; ficha: Ficha }
  | { ok: true; action: "review_student"; context: any; ficha?: undefined }
  | { ok: false; error: string };

export function validatePayload(body: any): Payload {
  if (!body || typeof body !== "object") return { ok: false, error: "Requisição inválida." };
  const { action, context, ficha } = body;
  if (action !== "analyze_workout" && action !== "review_student") return { ok: false, error: "Ação não disponível." };
  if (!context || typeof context !== "object") return { ok: false, error: "Faltou o contexto do aluno." };
  if (action === "review_student") {
    if (JSON.stringify({ context }).length > MAX_PAYLOAD_CHARS) return { ok: false, error: "Dados grandes demais para analisar." };
    return { ok: true, action, context };
  }
  if (!ficha || typeof ficha !== "object" || typeof ficha.nome !== "string") return { ok: false, error: "Faltou a ficha a analisar." };
  if (!Array.isArray(ficha.exercicios) || ficha.exercicios.length === 0) return { ok: false, error: "A ficha ainda não tem exercícios para analisar." };
  if (ficha.exercicios.length > 30) return { ok: false, error: "Ficha grande demais para analisar." };
  for (const ex of ficha.exercicios) {
    if (!ex || typeof ex.ref !== "string" || typeof ex.nome !== "string") return { ok: false, error: "Ficha com exercício inválido." };
  }
  if (JSON.stringify({ context, ficha }).length > MAX_PAYLOAD_CHARS) return { ok: false, error: "Dados grandes demais para analisar." };
  return { ok: true, action, context, ficha };
}

// Safety/quality rules shared by every copilot feature, so "Analisar Treino" and
// "Revisar Aluno" can never drift apart on what the AI may or may not claim.
const RULE = {
  dataOnly:
    "Use SOMENTE os dados do JSON fornecido (o 'contexto' do aluno e, quando houver, a 'ficha'). Nunca invente cargas, medidas, histórico, lesões ou resultados. " +
    "Se um dado necessário não existe (veja a lista 'lacunas' e os campos nulos), diga isso em 'dadosInsuficientes' e NÃO faça sugestão que dependa dele.",
  restrictions:
    "Respeite as restrições: se houver problemas de saúde ou zonas de dor, não sugira nada que os agrave; na dúvida, recomende que o personal avalie (confiança baixa). Você não faz diagnóstico médico.",
  insufficient:
    "DADOS INSUFICIENTES NÃO SÃO EVIDÊNCIA. Se 'frequenciaReal' for nulo, tiver dadosSuficientes = false, ou 'lacunas' contiver 'poucas_sessoes_registradas' ou 'historico_de_execucao': " +
    "NÃO avalie aderência, frequência real nem tendência de progressão, não classifique a frequência como baixa ou alta, e registre em 'dadosInsuficientes' que há poucas sessões registradas. " +
    "Um exercício com menos de 3 sessões registradas (sessoesRegistradas) ou com tendencia 'insuficiente' não prova progressão: não o cite como ponto positivo nem baseie ajuste de carga nele. " +
    "Nesse caso, baseie a análise só no que existe (a própria ficha, o perfil, as restrições, quando existirem).",
  summary: "'resumo' deve ter no máximo 3 frases curtas.",
  gender: "Trate o aluno no gênero do perfil: 'a aluna' se perfil.sexo for feminino, 'o aluno' se masculino; se ausente, use 'o(a) aluno(a)'.",
  language: "Escreva em português do Brasil, em linguagem direta de profissional para profissional.",
  confidence: "confianca: 'alta' só quando vários dados concordam; 'media' quando há um dado claro; 'baixa' quando é inferência.",
  sources: (list: string) =>
    `FONTES: fundamente cada item de '${list}' SOMENTE nas FONTES PERMITIDAS listadas abaixo, citando os ids (F1, F2...) em 'fontes'. ` +
    "NUNCA cite estudo, autor, ano, número, doi ou link que não esteja nessas fontes, e não invente referências. " +
    `Se nenhuma fonte permitida sustenta uma ideia, NÃO a inclua em '${list}'.`,
  caution:
    "Descreva a evidência com cautela ('as evidências indicam', 'sugerem'), sem afirmar mais do que o 'achado' da fonte diz e sem inventar números além dos que constam nele. " +
    "As fontes tratam de adultos saudáveis e de médias de grupos: a resposta individual varia. Não extrapole para lesões, dores ou condições de saúde; nesses casos recomende avaliação do personal ou de um profissional de saúde.",
  failure:
    "Não recomende treinar até a falha muscular, nem periodização específica, como regra: as fontes não mostram vantagem consistente nisso. Use as fontes para o que elas de fato mostram " +
    "(volume semanal, carga para força, descanso entre séries, frequência com volume igualado, proteína, atividade aeróbica, etc.).",
  pickSources:
    "Escolha as fontes pelo objetivo e pelo que o aluno precisa: hipertrofia/ganho de massa (F1, F2, F3, F4, F5, F6, F7, F8); força (F1, F2, F5); emagrecimento e definição (F9, F11, F10, F8, F1); condicionamento (F10, F11, F1). " +
    "Não force fontes só para preencher a lista.",
  nutrition:
    "O contexto NÃO traz dados de dieta. Sobre proteína (F8), só sugira CONFERIR se a ingestão da dieta do aluno está adequada, sem prescrever quantidade como meta e sem afirmar que 'a literatura demonstra'; " +
    "use confiança baixa. Não afirme nada sobre massa livre de gordura além do 'achado' da fonte.",
};

const numbered = (rules: string[]) => rules.map((r, i) => `${i + 1}. ${r}`).join("\n");

const RULES_ANALYZE = [
  RULE.dataOnly,
  RULE.restrictions,
  "Seja conservador: ajustes pequenos, no máximo " + MAX_ADJUSTMENTS + ". Priorize o que tem mais evidência nos dados " +
    "(progressão de carga, volume semanal vs meta, frequência real vs declarada, PSE/RIR, fase da periodização).",
  "Cada ajuste deve citar o dado concreto que o motivou (ex.: 'média de 8 séries/semana contra meta de 12').",
  "Um ajuste APLICÁVEL refere um exercício da ficha pelo campo 'ref' (e1, e2...) e um 'campo' entre: series, reps, cargaKg, descansoSeg, metodo, observacao, " +
    "com 'valorSugerido' coerente: series = inteiro de 1 a 10; reps = texto como '8-10' ou '12'; cargaKg = número em kg; descansoSeg = inteiro de 15 a 600; " +
    "metodo = um de [" + METHODS.join(", ") + "]; observacao = texto curto. " +
    "Se a recomendação NÃO é uma alteração de campo de um exercício (ex.: 'incluir um exercício de posterior', 'rever a frequência semanal'), " +
    "deixe ref, campo e valorSugerido nulos — será mostrada só como recomendação.",
  "Prefira ajustar parâmetros a sugerir trocar ou remover exercícios que já têm histórico de carga.",
  "Só sugira uma carga se houver 'proximaCargaSugeridaKg' ou histórico no contexto que a sustente; caso contrário não sugira carga.",
  RULE.language,
  RULE.confidence,
  "Se a ficha já está coerente com os dados, diga isso em 'resumo' e devolva poucos ou nenhum ajuste. Não force sugestões.",
  RULE.insufficient,
  RULE.summary,
  RULE.gender,
  "MELHORIAS PARA O OBJETIVO: se 'perfil.objetivo' existir, preencha 'melhoriasParaObjetivo' (de 1 a 4 itens) com recomendações para aproximar ESTA ficha do objetivo declarado, " +
    "sempre ancoradas nos dados do aluno e da ficha (ex.: séries semanais por grupo muscular, metas de volume, frequência, descanso, carga). " +
    "Se 'perfil.objetivo' for nulo, deixe 'melhoriasParaObjetivo' vazio e registre em 'dadosInsuficientes' que o objetivo do aluno não foi informado.",
  RULE.sources("melhoriasParaObjetivo") +
    " (Uma ideia sem fonte pode aparecer como ajuste comum, com confiança baixa, sem fontes.) Em 'ajustes', 'fontes' é opcional e só vale se a fonte realmente sustenta aquele ajuste.",
  RULE.caution,
  RULE.failure,
  RULE.pickSources,
  RULE.nutrition,
];

export const SYSTEM_PROMPT_ANALYZE =
  "Você é o copiloto de um personal trainer. Sua tarefa é analisar UMA ficha de treino de um aluno, a partir dos dados fornecidos, " +
  "e sugerir ajustes pontuais. Quem decide é o personal; você apenas sugere.\n\n" +
  "REGRAS:\n" + numbered(RULES_ANALYZE);

const RULES_REVIEW = [
  RULE.dataOnly,
  RULE.restrictions,
  "Preencha 'secoes' com quatro blocos — objetivo, frequencia, volume e progressao —, cada um com 'status' ('ok' = coerente com os dados; 'atencao' = merece atenção; 'insuficiente' = sem dados suficientes para avaliar) " +
    "e um 'texto' curto (1 a 2 frases) citando o dado concreto. objetivo: o objetivo declarado frente à ficha e ao perfil. frequencia: sessões reais frente ao declarado. " +
    "volume: séries por grupo muscular frente às metas e ao planejado. progressao: evolução das cargas.",
  RULE.insufficient,
  RULE.summary,
  RULE.gender,
  RULE.language,
  RULE.confidence,
  "'pontosPositivos' e 'pontosDeAtencao': no máximo 5 itens cada, curtos, cada um apoiado em um dado concreto do contexto. " +
    "'restricoes': resuma problemas de saúde, zonas de dor e observações do personal que EXISTAM no contexto, sem interpretar clinicamente; se não houver, deixe a lista vazia.",
  "'sugestoes' (de 0 a " + MAX_IMPROVEMENTS + " itens): melhorias para aproximar o aluno do objetivo declarado, ancoradas nos dados. " +
    "Se 'perfil.objetivo' for nulo, deixe 'sugestoes' vazio e registre em 'dadosInsuficientes' que o objetivo não foi informado.",
  RULE.sources("sugestoes"),
  RULE.caution,
  RULE.failure,
  RULE.pickSources,
  RULE.nutrition,
];

export const SYSTEM_PROMPT_REVIEW =
  "Você é o copiloto de um personal trainer. Sua tarefa é fazer o RAIO-X de um aluno ('Revisar Aluno'): avaliar, com base APENAS nos dados fornecidos, " +
  "como ele está em relação ao objetivo, à frequência, ao volume e à progressão, destacar pontos positivos, pontos de atenção e restrições, e sugerir melhorias. " +
  "É uma leitura informativa: nada será alterado automaticamente. Quem decide é o personal.\n\n" +
  "REGRAS:\n" + numbered(RULES_REVIEW);

const sourcesBlock = () =>
  "\n\nFONTES PERMITIDAS (as únicas que você pode citar):\n\n" +
  EVIDENCE_LIBRARY.map((s) => `${s.id} — ${s.tipo}. ${s.citacao}\nAchado: ${s.achado}`).join("\n\n");

export function buildSystemPrompt(action: string = "analyze_workout"): string {
  return (action === "review_student" ? SYSTEM_PROMPT_REVIEW : SYSTEM_PROMPT_ANALYZE) + sourcesBlock();
}

export const RESPONSE_SCHEMA_ANALYZE = {
  type: "OBJECT",
  properties: {
    resumo: { type: "STRING" },
    pontosPositivos: { type: "ARRAY", items: { type: "STRING" } },
    pontosDeAtencao: { type: "ARRAY", items: { type: "STRING" } },
    dadosInsuficientes: { type: "ARRAY", items: { type: "STRING" } },
    melhoriasParaObjetivo: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          titulo: { type: "STRING" },
          recomendacao: { type: "STRING" },
          porQue: { type: "STRING" },
          fontes: { type: "ARRAY", items: { type: "STRING" } },
          confianca: { type: "STRING", enum: ["alta", "media", "baixa"] },
        },
        required: ["titulo", "recomendacao", "porQue", "fontes", "confianca"],
      },
    },
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
          fontes: { type: "ARRAY", items: { type: "STRING" } },
        },
        required: ["sugestao", "motivo", "impacto", "confianca"],
      },
    },
  },
  required: ["resumo", "pontosPositivos", "pontosDeAtencao", "dadosInsuficientes", "melhoriasParaObjetivo", "ajustes"],
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

// Citations: only ids that exist in OUR library survive. Anything else the model
// writes as a "source" (an invented id, author, year, link…) is silently discarded,
// and the reference list the app shows is always built from the library's own text.
function makeCiter() {
  const libraryById = new Map(EVIDENCE_LIBRARY.map((s) => [s.id, s]));
  const numberById = new Map<string, number>();
  const references: Reference[] = [];
  const validIds = (raw: unknown): string[] => {
    const out: string[] = [];
    for (const v of Array.isArray(raw) ? raw : []) {
      const id = String(v ?? "").trim().toUpperCase();
      if (libraryById.has(id) && !out.includes(id)) out.push(id);
    }
    return out;
  };
  // Numbers references in order of first use.
  const register = (ids: string[]): number[] =>
    ids.map((id) => {
      let n = numberById.get(id);
      if (!n) {
        const s = libraryById.get(id)!;
        n = references.length + 1;
        numberById.set(id, n);
        references.push({ n, id, tipo: s.tipo, citacao: s.citacao, url: pubmedUrl(s.pmid), achado: s.achado });
      }
      return n;
    });
  return { validIds, register, references };
}

const confidenceOf = (v: unknown): Confidence => (["alta", "media", "baixa"].includes(String(v)) ? (v as Confidence) : "baixa");

// The context carries no diet data, so anything grounded in the nutrition source
// (F8, protein) can never be shown with more than low confidence, whatever the
// model claims.
const NUTRITION_SOURCE_IDS = ["F8"];
const capConfidence = (c: Confidence, ids: string[]): Confidence => (ids.some((id) => NUTRITION_SOURCE_IDS.includes(id)) ? "baixa" : c);

export function sanitizeAnalysis(parsed: any, ficha: Ficha, opts: { objetivo?: string | null } = {}): Analysis {
  const byRef = new Map(ficha.exercicios.map((e) => [e.ref, e]));
  const { validIds, register, references } = makeCiter();

  // Improvements toward the student's goal: need a declared goal, a
  // recommendation, and at least one valid source — otherwise the claim has
  // nothing behind it and is dropped rather than shown as "evidence-based".
  const improvements: Improvement[] = [];
  if (opts.objetivo) {
    for (const raw of Array.isArray(parsed?.melhoriasParaObjetivo) ? parsed.melhoriasParaObjetivo : []) {
      if (improvements.length >= MAX_IMPROVEMENTS) break;
      const recomendacao = clip(raw?.recomendacao, 400);
      const ids = validIds(raw?.fontes);
      if (!recomendacao || ids.length === 0) continue;
      improvements.push({
        titulo: clip(raw?.titulo, 80) || "Melhoria sugerida",
        recomendacao,
        porQue: clip(raw?.porQue, 400),
        fontes: register(ids),
        confianca: capConfidence(confidenceOf(raw?.confianca), ids),
      });
    }
  }

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

    const adjIds = validIds(raw?.fontes);
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
      confianca: capConfidence(confidenceOf(raw?.confianca), adjIds),
      fontes: register(adjIds),
    });
  }

  return {
    resumo: clip(parsed?.resumo, 600),
    objetivo: opts.objetivo ? clip(opts.objetivo, 60) : null,
    pontosPositivos: clipList(parsed?.pontosPositivos, 5, 300),
    pontosDeAtencao: clipList(parsed?.pontosDeAtencao, 5, 300),
    dadosInsuficientes: clipList(parsed?.dadosInsuficientes, 6, 200),
    melhoriasParaObjetivo: improvements,
    ajustes: adjustments,
    referencias: references,
    fontesVerificadasEm: EVIDENCE_VERIFIED_ON,
  };
}

// ---------------------------------------------------------------------------
// "Revisar Aluno": a read-only x-ray of the student. Nothing here is applied
// anywhere; it only informs the personal.
// ---------------------------------------------------------------------------
export type SectionStatus = "ok" | "atencao" | "insuficiente";
export type ReviewSection = { status: SectionStatus; texto: string };
export type Review = {
  resumo: string;
  objetivo: string | null;
  secoes: { objetivo: ReviewSection; frequencia: ReviewSection; volume: ReviewSection; progressao: ReviewSection };
  pontosPositivos: string[];
  pontosDeAtencao: string[];
  restricoes: string[];
  dadosInsuficientes: string[];
  sugestoes: Improvement[];
  referencias: Reference[];
  fontesVerificadasEm: string;
};

const SECTION_SCHEMA = {
  type: "OBJECT",
  properties: {
    status: { type: "STRING", enum: ["ok", "atencao", "insuficiente"] },
    texto: { type: "STRING" },
  },
  required: ["status", "texto"],
};

export const RESPONSE_SCHEMA_REVIEW = {
  type: "OBJECT",
  properties: {
    resumo: { type: "STRING" },
    secoes: {
      type: "OBJECT",
      properties: { objetivo: SECTION_SCHEMA, frequencia: SECTION_SCHEMA, volume: SECTION_SCHEMA, progressao: SECTION_SCHEMA },
      required: ["objetivo", "frequencia", "volume", "progressao"],
    },
    pontosPositivos: { type: "ARRAY", items: { type: "STRING" } },
    pontosDeAtencao: { type: "ARRAY", items: { type: "STRING" } },
    restricoes: { type: "ARRAY", items: { type: "STRING" } },
    dadosInsuficientes: { type: "ARRAY", items: { type: "STRING" } },
    sugestoes: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          titulo: { type: "STRING" },
          recomendacao: { type: "STRING" },
          porQue: { type: "STRING" },
          fontes: { type: "ARRAY", items: { type: "STRING" } },
          confianca: { type: "STRING", enum: ["alta", "media", "baixa"] },
        },
        required: ["titulo", "recomendacao", "porQue", "fontes", "confianca"],
      },
    },
  },
  required: ["resumo", "secoes", "pontosPositivos", "pontosDeAtencao", "restricoes", "dadosInsuficientes", "sugestoes"],
};

export function buildReviewUserText(context: unknown): string {
  return "Faça o raio-x do aluno com base no contexto abaixo.\n\n" + JSON.stringify({ contexto: context });
}

export function sanitizeReview(parsed: any, context: any): Review {
  const { validIds, register, references } = makeCiter();
  const statusOf = (v: unknown): SectionStatus => (["ok", "atencao", "insuficiente"].includes(String(v)) ? (v as SectionStatus) : "insuficiente");
  const section = (raw: any): ReviewSection => ({ status: statusOf(raw?.status), texto: clip(raw?.texto, 300) });
  const secoes = {
    objetivo: section(parsed?.secoes?.objetivo),
    frequencia: section(parsed?.secoes?.frequencia),
    volume: section(parsed?.secoes?.volume),
    progressao: section(parsed?.secoes?.progressao),
  };

  // Deterministic guards: whatever the model says, a block with no real data
  // behind it is shown as "insuficiente" (so a student with two logged sessions
  // never gets a verdict on adherence or progression).
  const objetivo: string | null = typeof context?.perfil?.objetivo === "string" && context.perfil.objetivo ? context.perfil.objetivo : null;
  if (!objetivo) {
    secoes.objetivo = { status: "insuficiente", texto: "Objetivo do aluno não informado (anamnese pendente)." };
  }
  const freq = context?.frequenciaReal;
  if (!freq || freq.dadosSuficientes === false) {
    secoes.frequencia = {
      status: "insuficiente",
      texto: clip(freq?.aviso, 300) || "Nenhuma sessão registrada nos últimos 90 dias: não dá para avaliar a frequência.",
    };
  }
  const progression: any[] = Array.isArray(context?.progressao?.porExercicio) ? context.progressao.porExercicio : [];
  const evaluable = progression.filter((p) => (p?.sessoesRegistradas ?? 0) >= MIN_SESSIONS_FOR_TREND && p?.tendencia && p.tendencia !== "insuficiente");
  if (evaluable.length === 0) {
    secoes.progressao = { status: "insuficiente", texto: `Menos de ${MIN_SESSIONS_FOR_TREND} sessões registradas por exercício: ainda não dá para avaliar a progressão.` };
  }
  const groups: any[] = Array.isArray(context?.volume?.porGrupo) ? context.volume.porGrupo : [];
  if (groups.length === 0) {
    secoes.volume = { status: "insuficiente", texto: "Sem séries planejadas nem executadas para avaliar o volume." };
  }

  const suggestions: Improvement[] = [];
  if (objetivo) {
    for (const raw of Array.isArray(parsed?.sugestoes) ? parsed.sugestoes : []) {
      if (suggestions.length >= MAX_IMPROVEMENTS) break;
      const recomendacao = clip(raw?.recomendacao, 400);
      const ids = validIds(raw?.fontes);
      if (!recomendacao || ids.length === 0) continue;
      suggestions.push({
        titulo: clip(raw?.titulo, 80) || "Sugestão",
        recomendacao,
        porQue: clip(raw?.porQue, 400),
        fontes: register(ids),
        confianca: capConfidence(confidenceOf(raw?.confianca), ids),
      });
    }
  }

  return {
    resumo: clip(parsed?.resumo, 600),
    objetivo: objetivo ? clip(objetivo, 60) : null,
    secoes,
    pontosPositivos: clipList(parsed?.pontosPositivos, 5, 300),
    pontosDeAtencao: clipList(parsed?.pontosDeAtencao, 5, 300),
    restricoes: clipList(parsed?.restricoes, 6, 300),
    dadosInsuficientes: clipList(parsed?.dadosInsuficientes, 6, 200),
    sugestoes: suggestions,
    referencias: references,
    fontesVerificadasEm: EVIDENCE_VERIFIED_ON,
  };
}
