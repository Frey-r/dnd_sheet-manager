/* Keeps the chosen tile of a scrolling grid in view without cutting the row above it. */
import { useEffect, type RefObject } from 'react';

/** Height of the fade at the bottom of the grids (index.css, .cc-race-grid / .cc-class-grid). */
const FADE_PX = 28;

/**
 * When `key` changes, scrolls `grid` the least needed to show its pressed tile ("nearest"), then
 * moves on to the next row boundary so no row is cut at the top edge. Visible tiles do not move.
 */
export function useRevealPressed(grid: RefObject<HTMLElement | null>, key: string) {
  useEffect(() => {
    const box = grid.current;
    const tile = box?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!box || !tile) return;
    const view = box.getBoundingClientRect();
    const rect = tile.getBoundingClientRect();
    if (rect.height === 0) return; // hidden step or no layout (tests)
    const top = rect.top - view.top + box.scrollTop;
    const bottom = top + rect.height;
    const pad = parseFloat(getComputedStyle(box).paddingTop) || 0;
    if (top - pad < box.scrollTop) {
      box.scrollTo({ top: top - pad });
    } else if (bottom > box.scrollTop + box.clientHeight - FADE_PX) {
      const nearest = bottom - box.clientHeight + FADE_PX;
      // First row start at or below the "nearest" offset: the tile stays visible, no row is cut.
      const rowTops = [...box.children].map((c) => c.getBoundingClientRect().top - view.top + box.scrollTop - pad);
      box.scrollTo({ top: Math.min(top - pad, ...rowTops.filter((t) => t >= nearest)) });
    }
  }, [grid, key]);
}
