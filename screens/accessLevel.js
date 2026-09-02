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

const GOAL_CALORIE_FACTOR = {
  emagrecimento: 0.80,
  ganho_de_massa: 1.10,
  definicao: 0.90,
  condicionamento: 1.0,
};

// Mifflin-St Jeor BMR + a fixed moderate-activity multiplier (this app's
// students all train with a personal, so we don't collect a separate
// activity-level question) + a per-goal calorie adjustment.
export function calculateMacroGoals({ sex, weightKg, heightCm, age, goal }) {
  const w = Number(weightKg);
  const h = Number(heightCm);
  const a = Number(age);
  if (!w || !h || !a || !sex) return null;

  const bmr = sex === 'masculino' ? 10 * w + 6.25 * h - 5 * a + 5 : 10 * w + 6.25 * h - 5 * a - 161;
  const tdee = bmr * 1.55;
  const kcal = Math.round(tdee * (GOAL_CALORIE_FACTOR[goal] ?? 1));

  const proteinG = Math.round(w * 2);
  const fatG = Math.round((kcal * 0.25) / 9);
  const carbsG = Math.max(0, Math.round((kcal - proteinG * 4 - fatG * 9) / 4));

  return { kcal, protein: proteinG, carbs: carbsG, fat: fatG };
}
