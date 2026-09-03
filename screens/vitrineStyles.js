import { Platform } from 'react-native';

// Shared design tokens for the pre-login landing/vitrine flow
// (WelcomeScreen, PlansSection, MaterialsSection, WorkoutsSection),
// so every section/card uses the same typography scale and card shell.

export const ACCENT = '#E05A17';

export const TRANSITION = Platform.OS === 'web'
  ? { transitionProperty: 'all', transitionDuration: '200ms', transitionTimingFunction: 'ease' }
  : {};

// Biases a cover-cropped cover photo toward its top edge (where uploaded covers tend to
// carry their title/ribbon text) instead of the default center crop. react-native-web's
// Image doesn't accept objectPosition/backgroundPosition in its style, so the crop anchor
// has to be faked by oversizing the image and pinning it to the top of an overflow:hidden box.
export const COVER_TOP_IMAGE = { position: 'absolute', top: 0, left: 0, width: '100%', height: '160%' };

// Flat, uniform card shell: #18181B background, 1px #27272A border, 16px radius, 20px padding.
export const FLAT_CARD = {
  backgroundColor: '#18181B',
  borderWidth: 1,
  borderColor: '#27272A',
  borderRadius: 16,
  padding: 20,
};

export function sectionTitleStyle(isDesktop) {
  const fontSize = isDesktop ? 24 : 18;
  return {
    color: '#FFFFFF',
    fontSize,
    fontWeight: '700',
    letterSpacing: fontSize * 0.05,
    textAlign: 'center',
    textTransform: 'uppercase',
    marginTop: 28,
    marginBottom: 8,
  };
}

export const CARD_TITLE = { fontSize: 16, fontWeight: '600', color: '#FFFFFF' };

export const SUPPORT_TEXT = {
  fontSize: 13,
  fontWeight: '400',
  color: '#A1A1AA',
  lineHeight: 18,
};

export const CARD_DESCRIPTION = { fontSize: 12, fontWeight: '400', color: '#A1A1AA', lineHeight: 17 };

export const CARD_BADGE = {
  backgroundColor: 'rgba(224,90,23,0.12)',
  borderRadius: 8,
  paddingHorizontal: 8,
  paddingVertical: 3,
};

export const CARD_BADGE_TEXT = { color: ACCENT, fontSize: 10, fontWeight: '700' };

export const GRID_GAP = 16;
