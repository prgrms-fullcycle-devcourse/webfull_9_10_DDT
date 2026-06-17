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

// 프로필 이미지 옵션 중 랜덤 인덱스를 반환한다. (게스트 입장 시 초기 프로필 랜덤 부여용)
export const getRandomProfileIndex = () =>
  Math.floor(Math.random() * PROFILE_IMAGE_OPTIONS.length);

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

/**
 * 프로필 이미지 키를 실제 이미지 경로(src)로 변환한다. 현재 키와 레거시 키를 모두 지원한다.
 *
 * @param key - 프로필 이미지 키 (현재/레거시)
 * @returns 이미지 경로, 매칭 없거나 key가 없으면 undefined
 */
export const getProfileImageSrc = (key?: string | null) => {
  if (!key) return undefined;
  const option = PROFILE_IMAGE_OPTIONS.find((item) => item.key === key);
  return option?.src ?? legacyProfileImageMap[key];
};

/**
 * 현재 키(basic_image_key_NN)를 백엔드 저장용 레거시 키(AVATAR_*)로 변환한다.
 *
 * @param key - 현재 프로필 키
 * @returns 대응하는 레거시 키, 매핑 없으면 입력값 그대로
 */
export const getLegacyProfileImageKey = (key?: string | null) => {
  if (!key) return undefined;
  return activeToLegacyProfileKey[key] ?? key;
};

/**
 * 임의의(현재/레거시) 키를 PROFILE_IMAGE_OPTIONS의 현재 키로 정규화한다. (선택 인덱스 매칭용)
 *
 * @param key - 현재 또는 레거시 프로필 키
 * @returns 정규화된 현재 키, 매칭 없으면 undefined
 */
export const getProfileImageOptionKey = (key?: string | null) => {
  if (!key) return undefined;
  if (PROFILE_IMAGE_OPTIONS.some((item) => item.key === key)) return key;
  return legacyToActiveProfileKey[key];
};
