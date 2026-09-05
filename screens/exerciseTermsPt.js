// Practical (not exhaustive) PT→EN glossary for gym exercise/movement terms,
// used to translate a personal's Portuguese exercise name into something
// ExerciseDB's English-only catalog can actually match. Word-by-word best
// effort: unmatched words are left as-is rather than blocking the search.
const TERMS = {
  supino: 'bench press',
  agachamento: 'squat',
  levantamento: 'lift',
  terra: 'deadlift',
  remada: 'row',
  puxada: 'pulldown',
  desenvolvimento: 'shoulder press',
  elevacao: 'raise',
  lateral: 'lateral',
  frontal: 'front',
  rosca: 'curl',
  triceps: 'triceps',
  biceps: 'biceps',
  peito: 'chest',
  costas: 'back',
  ombro: 'shoulder',
  ombros: 'shoulders',
  perna: 'leg',
  pernas: 'legs',
  quadriceps: 'quadriceps',
  posterior: 'hamstring',
  gluteo: 'glute',
  gluteos: 'glutes',
  panturrilha: 'calf',
  panturrilhas: 'calves',
  abdomen: 'abs',
  abdominal: 'abs',
  antebraco: 'forearm',
  extensao: 'extension',
  flexao: 'flexion',
  flexora: 'curl',
  extensora: 'extension',
  cadeira: 'chair',
  banco: 'bench',
  reto: 'flat',
  inclinado: 'incline',
  declinado: 'decline',
  livre: 'free',
  maquina: 'machine',
  polia: 'cable',
  cabo: 'cable',
  barra: 'barbell',
  halter: 'dumbbell',
  halteres: 'dumbbells',
  fixa: 'pull up',
  corda: 'rope',
  abdutora: 'abduction',
  adutora: 'adduction',
  crucifixo: 'fly',
  voador: 'fly',
  encolhimento: 'shrug',
  afundo: 'lunge',
  avanco: 'lunge',
  stiff: 'stiff leg deadlift',
  gemeos: 'calf raise',
};

// Whole-phrase overrides checked BEFORE the word-by-word fallback, for exercise
// names where translating word-by-word gives a poor (or wrong) match against
// ExerciseDB's actual catalog names.
const PHRASES = {
  'abdominal bicicleta': 'bicycle crunch',
  'bicicleta': 'bicycle crunch',
  'supino reto': 'barbell bench press',
  'supino inclinado': 'incline bench press',
  'supino declinado': 'decline bench press',
  'agachamento livre': 'barbell squat',
  'agachamento smith': 'smith machine squat',
  'agachamento sumo': 'sumo squat',
  'cadeira extensora': 'leg extension',
  'cadeira flexora': 'leg curl',
  'mesa flexora': 'lying leg curl',
  'leg press': 'leg press',
  'remada curvada': 'bent over row',
  'remada cavalinho': 't bar row',
  'remada baixa': 'seated cable row',
  'puxada frente': 'lat pulldown',
  'puxada costas': 'lat pulldown',
  'puxada alta': 'lat pulldown',
  'desenvolvimento ombro': 'shoulder press',
  'desenvolvimento militar': 'military press',
  'elevacao lateral': 'lateral raise',
  'elevacao frontal': 'front raise',
  'rosca direta': 'biceps curl',
  'rosca alternada': 'dumbbell curl',
  'rosca martelo': 'hammer curl',
  'rosca scott': 'preacher curl',
  'triceps testa': 'skull crusher',
  'triceps corda': 'triceps pushdown',
  'triceps pulley': 'triceps pushdown',
  'triceps frances': 'overhead triceps extension',
  'panturrilha em pe': 'standing calf raise',
  'panturrilha sentado': 'seated calf raise',
  'abdominal infra': 'leg raise',
  'abdominal supra': 'crunch',
  'abdominal canivete': 'v up',
  'abdominal obliquo': 'oblique crunch',
  'prancha': 'plank',
  'crucifixo reto': 'chest fly',
  'flexao de braco': 'push up',
  'flexao de bracos': 'push up',
  'barra fixa': 'pull up',
  'levantamento terra': 'deadlift',
  'encolhimento de ombros': 'shrug',
};

function stripAccents(text) {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

export function translateExerciseNamePtToEn(name) {
  if (!name) return '';
  const cleaned = stripAccents(name.toLowerCase()).trim();
  if (PHRASES[cleaned]) return PHRASES[cleaned];

  const words = cleaned.split(/\s+/).filter(Boolean);
  return words.map((word) => TERMS[word] || word).join(' ');
}
