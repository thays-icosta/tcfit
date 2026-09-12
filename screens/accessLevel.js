export function hasAccessByLevel(myLevel, requiredLevel) {
  if (!requiredLevel) return false;
  if (requiredLevel === 'plataforma_base') return true;
  return myLevel === 'consultoria_vip';
}

export const HOME_CATEGORIES = [
  { value: 'planilha_academia', label: 'Planilhas Academia' },
  { value: 'planilha_casa', label: 'Planilhas Casa' },
  { value: 'treino_3d', label: 'Treino 3D' },
  { value: 'dieta_ebook', label: 'Dietas + E-books' },
  { value: 'modulo_corrida', label: 'Módulo Corrida' },
  { value: 'treino_extra', label: 'Treinos Extras' },
];

export const PROGRAM_LEVELS = [
  { value: 'iniciante', label: 'Iniciante' },
  { value: 'intermediario', label: 'Intermediário' },
  { value: 'avancado', label: 'Avançado' },
];

export const PROGRAM_GOALS = [
  { value: 'emagrecimento', label: 'Emagrecimento' },
  { value: 'ganho_de_massa', label: 'Ganho de Massa' },
  { value: 'definicao', label: 'Definição' },
  { value: 'condicionamento', label: 'Condicionamento' },
];

export const TRAINING_LOCATIONS = [
  { value: 'academia', label: 'Academia' },
  { value: 'casa', label: 'Casa' },
  { value: 'rua', label: 'Rua' },
];

export const DAYS_PER_WEEK_OPTIONS = [2, 3, 4, 5, 6];

export const SESSION_DURATION_OPTIONS = [
  { value: 30, label: '30 min' },
  { value: 45, label: '45 min' },
  { value: 60, label: '60 min' },
  { value: 90, label: '90+ min' },
];

export const ACTIVITY_LEVELS = [
  { value: 'sedentario', label: 'Sedentário (trabalho parado)' },
  { value: 'moderado', label: 'Moderado (fica de pé/anda bastante)' },
  { value: 'ativo', label: 'Ativo (trabalho físico)' },
];

export const SLEEP_QUALITY_OPTIONS = [
  { value: 'ruim', label: 'Ruim' },
  { value: 'regular', label: 'Regular' },
  { value: 'boa', label: 'Boa' },
];

// Same vocabulary as exercises.muscle_group, reused here so an anamnese's
// "foco específico" and a template's own focus_muscle_group line up exactly
// for the auto-suggestion matching.
export const MUSCLE_FOCUS_OPTIONS = [
  { value: 'gluteo', label: 'Glúteo' },
  { value: 'quadriceps', label: 'Pernas' },
  { value: 'abdomen', label: 'Abdômen' },
  { value: 'costas', label: 'Costas' },
  { value: 'peito', label: 'Peito' },
  { value: 'ombro', label: 'Ombro' },
  { value: 'biceps', label: 'Braços' },
];

export const WORKOUT_GOALS = [
  { value: 'hipertrofia', label: 'Hipertrofia' },
  { value: 'emagrecimento', label: 'Emagrecimento' },
  { value: 'sem_equipamentos', label: 'Sem Equipamentos' },
  { value: 'cardio', label: 'Cardio' },
  { value: 'definicao', label: 'Definição' },
];

export const PAIN_ZONES = [
  { value: 'lombar', label: 'Lombar' },
  { value: 'joelho', label: 'Joelho' },
  { value: 'ombro', label: 'Ombro' },
  { value: 'cervical', label: 'Cervical' },
  { value: 'punho', label: 'Punho' },
  { value: 'tornozelo', label: 'Tornozelo' },
  { value: 'quadril', label: 'Quadril' },
  { value: 'cotovelo', label: 'Cotovelo' },
];

export const ANAMNESE_QUESTION_TYPES = [
  { value: 'texto_curto', label: 'Texto curto' },
  { value: 'texto_longo', label: 'Texto longo' },
  { value: 'multipla_escolha', label: 'Múltipla escolha' },
  { value: 'sim_nao', label: 'Sim/Não' },
];

export const SEX_OPTIONS = [
  { value: 'masculino', label: 'Masculino' },
  { value: 'feminino', label: 'Feminino' },
];

export const TARGET_AUDIENCE_OPTIONS = [
  { value: 'unissex', label: 'Unissex' },
  { value: 'feminino', label: 'Feminino' },
  { value: 'masculino', label: 'Masculino' },
];

// Fixed roadmap of sub-levels shown inside the Módulo Corrida carousel, in
// this order, regardless of which ones the personal has already published.
export const RUNNING_LEVELS = [
  { value: 'guia_aluno', label: 'Guia do Aluno', icon: 'book-outline' },
  { value: '0_a_5km', label: '0 aos 5km', icon: 'walk-outline' },
  { value: '5_a_10km', label: '5km aos 10km', icon: 'speedometer-outline' },
  { value: 'maratona', label: 'Maratona', icon: 'trophy-outline' },
];

export const NUTRITION_TAGS = [
  { value: 'celiaca', label: 'Celíaca', icon: 'leaf-outline' },
  { value: 'emagrecimento', label: 'Emagrecimento', icon: 'flame-outline' },
  { value: 'hipertrofia', label: 'Hipertrofia', icon: 'barbell-outline' },
  { value: 'menopausa', label: 'Menopausa', icon: 'flower-outline' },
  { value: 'vegana', label: 'Vegana', icon: 'nutrition-outline' },
  { value: 'vegetariana', label: 'Vegetariana', icon: 'nutrition-outline' },
  { value: 'lactante', label: 'Lactante', icon: 'heart-outline' },
  { value: 'gestante', label: 'Gestante', icon: 'heart-outline' },
];

export const WORKOUT_TAGS = [
  { value: 'mulheres', label: 'Mulheres', icon: 'woman-outline', badge: 'PARA MULHERES' },
  { value: 'homens', label: 'Homens', icon: 'man-outline', badge: 'PARA HOMENS' },
  { value: 'academia', label: 'Academia', icon: 'barbell-outline', badge: 'ACADEMIA' },
  { value: 'em_casa', label: 'Treino em Casa', icon: 'home-outline', badge: 'TREINO EM CASA' },
  { value: 'corrida_cardio', label: 'Corrida & Cardios', icon: 'walk-outline', badge: 'CORRIDA & CARDIOS' },
  { value: 'planilhas', label: 'Planilhas', icon: 'document-text-outline', badge: 'EM PLANILHA' },
];

const GOAL_CALORIE_FACTOR = {
  emagrecimento: 0.80,
  ganho_de_massa: 1.10,
  definicao: 0.90,
  condicionamento: 1.0,
};

// Same three levels the anamnese already asks for (ACTIVITY_LEVELS below) —
// standard Harris-Benedict-style activity multipliers over BMR to get TDEE.
const ACTIVITY_MULTIPLIER = {
  sedentario: 1.2,
  moderado: 1.55,
  ativo: 1.725,
};

// Mifflin-St Jeor BMR × the aluno's actual activity level (from the
// anamnese) = TDEE, then a per-goal calorie adjustment on top. Falls back to
// "moderado" only if activityLevel wasn't collected yet.
export function calculateMacroGoals({ sex, weightKg, heightCm, age, goal, activityLevel }) {
  const w = Number(weightKg);
  const h = Number(heightCm);
  const a = Number(age);
  if (!w || !h || !a || !sex) return null;

  const bmr = sex === 'masculino' ? 10 * w + 6.25 * h - 5 * a + 5 : 10 * w + 6.25 * h - 5 * a - 161;
  const activityMultiplier = ACTIVITY_MULTIPLIER[activityLevel] ?? ACTIVITY_MULTIPLIER.moderado;
  const tdee = bmr * activityMultiplier;
  const kcal = Math.round(tdee * (GOAL_CALORIE_FACTOR[goal] ?? 1));

  const proteinG = Math.round(w * 2);
  const fatG = Math.round((kcal * 0.25) / 9);
  const carbsG = Math.max(0, Math.round((kcal - proteinG * 4 - fatG * 9) / 4));

  return { bmr: Math.round(bmr), tdee: Math.round(tdee), kcal, protein: proteinG, carbs: carbsG, fat: fatG };
}

// BMI 18.5–24.9 (WHO "normal" band) translated into a weight range for this
// height. A math reference point only — never call this an "ideal weight."
export function calculateHealthyWeightRange(heightCm) {
  const h = Number(heightCm);
  if (!h) return null;
  const heightM = h / 100;
  return {
    minKg: Math.round(18.5 * heightM * heightM * 10) / 10,
    maxKg: Math.round(24.9 * heightM * heightM * 10) / 10,
  };
}
