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
