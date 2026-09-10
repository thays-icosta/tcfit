// Block schema for project_contents.blocks (jsonb). Each block is a small,
// self-contained piece of educational content — the whole point is to never
// render a big wall of text, always títulos/cards/tópicos/destaques/dicas.
//
// Block shapes:
//   { type: 'heading', text }
//   { type: 'paragraph', text }
//   { type: 'card', icon, title, text }
//   { type: 'topic_list', items: string[] }
//   { type: 'highlight', text }
//   { type: 'tip', text }
//   { type: 'checklist', items: string[] }

export const BLOCK_TYPES = [
  { value: 'heading', label: 'Título' },
  { value: 'paragraph', label: 'Parágrafo' },
  { value: 'card', label: 'Card' },
  { value: 'topic_list', label: 'Tópicos' },
  { value: 'highlight', label: 'Destaque' },
  { value: 'tip', label: 'Dica TcFit' },
  { value: 'checklist', label: 'Checklist' },
];

export function createEmptyBlock(type) {
  switch (type) {
    case 'heading':
    case 'paragraph':
    case 'highlight':
    case 'tip':
      return { type, text: '' };
    case 'card':
      return { type, title: '', text: '' };
    case 'topic_list':
      return { type, items: [''] };
    case 'checklist':
      return { type, items: [''] };
    default:
      return { type: 'paragraph', text: '' };
  }
}

export function blockLabel(type) {
  return BLOCK_TYPES.find((t) => t.value === type)?.label || type;
}
