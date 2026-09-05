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

function stripAccents(text) {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

export function translateExerciseNamePtToEn(name) {
  if (!name) return '';
  const words = stripAccents(name.toLowerCase()).split(/\s+/).filter(Boolean);
  return words.map((word) => TERMS[word] || word).join(' ');
}
