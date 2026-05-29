export const PROFILE_IMAGE_OPTIONS = [
  { key: 'basic_image_key_01', src: '/avatars/bear.png', label: 'bear' },
  { key: 'basic_image_key_02', src: '/avatars/cat.png', label: 'cat' },
  { key: 'basic_image_key_03', src: '/avatars/crocodile.png', label: 'crocodile' },
  { key: 'basic_image_key_04', src: '/avatars/fox.png', label: 'fox' },
  { key: 'basic_image_key_05', src: '/avatars/hedgehog.png', label: 'hedgehog' },
  { key: 'basic_image_key_06', src: '/avatars/monkey.png', label: 'monkey' },
  { key: 'basic_image_key_07', src: '/avatars/penguin.png', label: 'penguin' },
  { key: 'basic_image_key_08', src: '/avatars/pig.png', label: 'pig' },
  { key: 'basic_image_key_09', src: '/avatars/rabbit.png', label: 'rabbit' },
  { key: 'basic_image_key_10', src: '/avatars/shiba.png', label: 'shiba' },
] as const;

export const DEFAULT_PROFILE_IMAGE_KEY = 'basic_image_key_01';

const activeToLegacyProfileKey: Record<string, string> = {
  AVATAR_BEAR: 'basic_image_key_01',
  AVATAR_CAT: 'basic_image_key_02',
  AVATAR_CROCODILE: 'basic_image_key_03',
  AVATAR_FOX: 'basic_image_key_04',
  AVATAR_HEDGEHOG: 'basic_image_key_05',
  AVATAR_MONKEY: 'basic_image_key_06',
  AVATAR_PENGUIN: 'basic_image_key_07',
  AVATAR_PIG: 'basic_image_key_08',
  AVATAR_RABBIT: 'basic_image_key_09',
  AVATAR_SHIBA: 'basic_image_key_10',
};

const legacyProfileImageMap: Record<string, string> = {
  DEFAULT_PROFILE_1: '/avatars/bear.png',
  AVATAR_BEAR: '/avatars/bear.png',
  AVATAR_CAT: '/avatars/cat.png',
  AVATAR_CROCODILE: '/avatars/crocodile.png',
  AVATAR_FOX: '/avatars/fox.png',
  AVATAR_HEDGEHOG: '/avatars/hedgehog.png',
  AVATAR_MONKEY: '/avatars/monkey.png',
  AVATAR_PENGUIN: '/avatars/penguin.png',
  AVATAR_PIG: '/avatars/pig.png',
  AVATAR_RABBIT: '/avatars/rabbit.png',
  AVATAR_SHIBA: '/avatars/shiba.png',
  char_01: '/avatars/bear.png',
  char_02: '/avatars/cat.png',
  char_03: '/avatars/crocodile.png',
  char_04: '/avatars/fox.png',
  char_05: '/avatars/hedgehog.png',
  char_06: '/avatars/monkey.png',
  char_07: '/avatars/penguin.png',
  char_08: '/avatars/pig.png',
  char_09: '/avatars/rabbit.png',
  char_10: '/avatars/shiba.png',
};

const legacyToActiveProfileKey = Object.entries(activeToLegacyProfileKey).reduce(
  (acc, [active, legacy]) => ({ ...acc, [legacy]: active }),
  {} as Record<string, string>,
);

export const getProfileImageSrc = (key?: string | null) => {
  if (!key) return undefined;
  const option = PROFILE_IMAGE_OPTIONS.find((item) => item.key === key);
  return option?.src ?? legacyProfileImageMap[key];
};

export const getLegacyProfileImageKey = (key?: string | null) => {
  if (!key) return undefined;
  return activeToLegacyProfileKey[key] ?? key;
};

export const getProfileImageOptionKey = (key?: string | null) => {
  if (!key) return undefined;
  if (PROFILE_IMAGE_OPTIONS.some((item) => item.key === key)) return key;
  return legacyToActiveProfileKey[key];
};
