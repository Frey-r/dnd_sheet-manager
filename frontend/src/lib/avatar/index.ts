/* Pixel-art avatar (openspec/specs/character-appearance.md). */
export * from './types';
export { resolveRaceVisual, splitSource, COMMON_RACES, visualByKey, ALL_FAMILY_KEYS } from './races';
export { auraForClass } from './classColors';
export { avatarCanvas, drawAvatarInto, cropRect, propForClass, AVATAR_W, AVATAR_H } from './render';
export { SKIN, HAIR, EYES, CLOTH } from './palettes';
export { renderLayers, spriteMetrics, type Box, type SpriteLayers, type SpriteMetrics, type Tag } from './metrics';
