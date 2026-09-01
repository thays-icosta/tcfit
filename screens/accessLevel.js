export function hasAccessByLevel(myLevel, requiredLevel) {
  if (!requiredLevel) return false;
  if (requiredLevel === 'plataforma_base') return true;
  return myLevel === 'consultoria_vip';
}

export const HOME_CATEGORIES = [
  { value: 'planilha_academia', label: 'Planilhas Academia' },
  { value: 'planilha_casa', label: 'Planilhas Casa' },
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
