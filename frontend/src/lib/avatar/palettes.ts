/* Colour palettes offered by the appearance editor. Skin palettes are per race family. */

export const SKIN = {
  human: ['#f6d7c3', '#eac0a0', '#d9a07a', '#c68642', '#a86b3c', '#8d5524', '#6b3e1f', '#4a2a16'],
  elf: ['#f7e3d5', '#eccdb4', '#d9ad8a', '#b9825a', '#8d5a3a', '#e8d6c8', '#c9b3a0', '#6b4a33'],
  drow: ['#4b4560', '#5a4f73', '#3d3a4f', '#6b5f85', '#2e2b3a', '#7d6f94'],
  pale: ['#f4e8f0', '#e6dcef', '#dfe9f2', '#f2efe6', '#d6d9e0', '#efe0d4'],
  tiefling: ['#c0392b', '#9b2d4a', '#7d3c98', '#5b3f8c', '#3f5aa8', '#d98c8c', '#8e5b6b', '#b04a2e'],
  dragon: ['#b73a2e', '#2f5fa8', '#3c8a4a', '#2b2b33', '#dfe6ea', '#d4a72c', '#b9c3cc', '#a8692f', '#b5653b', '#7a4fa8'],
  orc: ['#7a9a52', '#5f7f45', '#8a9a7a', '#6e6e5e', '#9aa36b', '#4f6b3a', '#a08a6a', '#7f8c8d'],
  goblin: ['#8fae4a', '#b5a642', '#c97d3a', '#7d9a3a', '#a3693a', '#c9a23a', '#6b8a3a', '#d98a4a'],
  gith: ['#c9c27a', '#b4b06a', '#a8b47a', '#d4c98a', '#9aa86a', '#c2b98f'],
  firbolg: ['#8ba3c7', '#a0b4d0', '#c9a0b0', '#7d93b8', '#b0a0c9', '#9fb8a8'],
  blue: ['#5f8fc9', '#7aa3d6', '#4a78b0', '#88b6c9', '#6a9fb5', '#3f6f9a'],
  sea: ['#6fb3b8', '#5a9fa8', '#7ac9c0', '#4a8a9a', '#8ac0d6', '#3f7a8a'],
  genasi: ['#d9542c', '#f08a3a', '#3f7fbf', '#5fb3c9', '#8a7350', '#6b6b6b', '#cfe3ef', '#a8c6dc'],
  metal: ['#8a8f96', '#6f7680', '#a39a8a', '#7a5a3a', '#5a6470', '#b0a080', '#9a6a4a', '#4a5058'],
  fur: ['#e0a040', '#c9823a', '#f2e6d0', '#8a6a4a', '#3a3a3a', '#b8b8b8', '#d4b483', '#6b4a33'],
  feather: ['#3a3a44', '#6b4a2e', '#c9c9c9', '#2e5fa8', '#b03a2e', '#d4a72c', '#5a7a3a', '#f2f2f2'],
  reptile: ['#5a8a3a', '#3f6b4a', '#8a9a3a', '#6b5a3a', '#4a7a6a', '#a07a3a', '#3a5a3a', '#8a4a3a'],
  amphibian: ['#6aa84f', '#3f8a6a', '#c9a23a', '#d9542c', '#3f6fbf', '#8a5ab0'],
  elephant: ['#8a8a8a', '#a09a94', '#6f6a66', '#b0a8a0', '#7a7f86'],
  undead: ['#c8c4b4', '#a9b0a0', '#8f9a86', '#d9d4c8', '#9aa0a8', '#b8a8a0'],
  bone: ['#e8e2d0', '#d9cfb4', '#c9bfa4', '#f2eee4'],
  ooze: ['#6ac9a0', '#8a6ad0', '#d96a8a', '#6a9fd9', '#c9c96a', '#5ab07a'],
  insect: ['#6b8a3a', '#a08a3a', '#3f6b6b', '#8a5a3a', '#5a5a7a', '#c9a23a'],
  plant: ['#6b9a4a', '#8ab05a', '#4a7a3a', '#a0b46a', '#7a6a4a', '#c9b47a'],
  fey: ['#f6d7c3', '#d9a07a', '#c9e0b0', '#d6c9ef', '#b0d6e0', '#8d5524'],
  wood: ['#b08a5a', '#8a6a4a', '#c9a77a', '#6b4a33', '#d9c09a'],
} as const;

export type SkinKey = keyof typeof SKIN;

export const HAIR = ['#1d1a18', '#3b2416', '#6b3e1f', '#a0522d', '#d9a441', '#e8d8a8', '#b8b8b8', '#f2f2f2', '#a83232', '#3a5fa8', '#3a8a4a', '#8a3aa8'];

export const EYES = ['#3b6ea5', '#4a8a4a', '#6b4a2e', '#2b2b2b', '#8a6ad0', '#c9a227', '#c0392b', '#9ad0e0', '#f2f2f2', '#e07a2e'];

export const CLOTH = [
  '#7a2e2e', '#b5452c', '#d9b26f', '#e8dcc0', '#3f6b3a', '#6b8a3a', '#2e4a7a', '#5a8ac9',
  '#5a3a7a', '#a05a9a', '#4a3a2a', '#8a6a4a', '#2b2b30', '#6f6f78', '#b8b8c0', '#c9a227',
];

/** Fixed beak / horn / nail colours. */
export const KERATIN = '#d9a441';
export const HORN = '#8a7468';
export const BONE = '#ece6d6';
