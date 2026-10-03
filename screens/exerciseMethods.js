// Execution methods a workout_exercises row can carry (execution_method).
// One list for the add / edit / bulk-edit screens instead of a copy in each.
export const METHODS = ['tradicional', 'rest-pause', 'bi-set', 'drop-set', 'piramide'];

export const METHOD_LABELS = {
  'tradicional': 'Tradicional',
  'rest-pause': 'Rest-Pause',
  'bi-set': 'Bi-set',
  'drop-set': 'Drop-set',
  'piramide': 'Pirâmide',
};

// What a freshly added exercise starts with (the same defaults the add
// screen has always used). Adding is "pick it, it's in the list"; the
// numbers get set afterwards, all at once, in the bulk editor.
export const DEFAULT_EXERCISE_CONFIG = {
  sets: 3,
  reps: '10',
  load_kg: null,
  cadence: null,
  rest_time_seconds: 60,
  execution_method: 'tradicional',
  notes: null,
};
