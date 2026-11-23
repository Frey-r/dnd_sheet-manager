/* Theme persistence (design-system.md): dark default, light, high contrast. */
export type Theme = 'dark' | 'light' | 'contrast';

export function applyTheme(theme: Theme) {
  if (theme === 'dark') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
  try { localStorage.setItem('theme', theme); } catch { /* storage may be blocked */ }
}

export function currentTheme(): Theme {
  const t = document.documentElement.dataset.theme;
  return t === 'light' || t === 'contrast' ? t : 'dark';
}
