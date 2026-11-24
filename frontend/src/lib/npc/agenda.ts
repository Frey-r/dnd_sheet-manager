/* NPC agenda: types, labels and helpers shared by the manager and the board (openspec/specs/npc-agenda.md). */
import type { Route } from '../vtt/routePosition';

export type TimeOfDay = 'dia' | 'tarde' | 'noche';
/** A game day number, or todos / laborables / fin_de_semana / lunes … domingo. */
export type DaySpec = number | string;

export interface AgendaEntry {
  dia: DaySpec;
  momento: TimeOfDay;
  /** null = away: off every map. */
  ubicacion: { escena_id: number; escena?: string } | null;
  posicion?: { x: number; y: number };
  path?: Route | null;
  oculto?: boolean;
  nota?: string;
}

export interface GameClock { game_day: number; time_of_day: TimeOfDay; weekday: string; first_weekday: string }

export interface ApplySummary {
  creados: string[];
  movidos: string[];
  retirados: string[];
  sin_cambios: number;
  saltados: { nombre: string; motivo: string }[];
}

export type WhereState = 'en_ruta' | 'quieto' | 'pausado' | 'detenido' | 'en_combate' | 'ausente' | 'sin_agenda';
export interface Whereabout {
  npc_id: number;
  nombre: string;
  relacion: string;
  escena_id: number | null;
  escena: string;
  estado: WhereState;
  siguiente: AgendaEntry | null;
}

export interface SceneRef { id: number; name: string }

export const MOMENTS: TimeOfDay[] = ['dia', 'tarde', 'noche'];
export const WEEKDAYS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
const WEEKDAY_LABEL: Record<string, string> = {
  lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles', jueves: 'Jueves', viernes: 'Viernes', sabado: 'Sábado', domingo: 'Domingo',
};
const MOMENT_LABEL: Record<string, string> = { dia: 'Día', tarde: 'Tarde', noche: 'Noche' };
export const STATE_LABEL: Record<WhereState, string> = {
  en_ruta: 'En ruta', quieto: 'Quieto', pausado: 'Pausado', detenido: 'Detenido', en_combate: 'En combate', ausente: 'Ausente', sin_agenda: 'Sin agenda',
};

export function dayLabel(d: DaySpec): string {
  if (typeof d === 'number') return `Día ${d}`;
  if (d === 'todos') return 'Todos los días';
  if (d === 'laborables') return 'Laborables (lun–vie)';
  if (d === 'fin_de_semana') return 'Fin de semana';
  return WEEKDAY_LABEL[d] ?? d;
}

export const momentLabel = (m: string) => MOMENT_LABEL[m] ?? m;

export const clockLabel = (c: GameClock) => `Día ${c.game_day} · ${(WEEKDAY_LABEL[c.weekday] ?? c.weekday).toLowerCase()} · ${momentLabel(c.time_of_day)}`;

/** "Muralla · patrulla de 3 puntos", "Cuartel · quieto en (70, 70) · oculto", "Ausente (fuera de los mapas)". */
export function describeEntry(e: AgendaEntry, scenes: SceneRef[]): string {
  if (!e.ubicacion) return 'Ausente (fuera de los mapas)';
  const name = scenes.find((s) => s.id === e.ubicacion!.escena_id)?.name ?? e.ubicacion.escena;
  if (!name) return `Escena borrada (${e.ubicacion.escena_id})`;
  let what: string;
  if (e.path) {
    const n = e.path.points.length;
    what = e.path.mode === 'loop' ? `patrulla de ${n} puntos` : e.path.mode === 'pingpong' ? `ida y vuelta (${n} puntos)` : `ida (${n} puntos)`;
  } else {
    what = e.posicion ? `quieto en (${Math.round(e.posicion.x)}, ${Math.round(e.posicion.y)})` : 'quieto';
  }
  return `${name} · ${what}${e.oculto ? ' · oculto' : ''}`;
}

const keyOf = (e: AgendaEntry) => `${e.dia}|${e.momento}`;

/** Replaces the entry with the same day and moment, or appends it. Never mutates. */
export function upsertEntry(agenda: AgendaEntry[], entry: AgendaEntry): AgendaEntry[] {
  const i = agenda.findIndex((e) => keyOf(e) === keyOf(entry));
  return i >= 0 ? agenda.map((e, j) => (j === i ? entry : e)) : [...agenda, entry];
}

/** Precedence of a day selector (lower = more specific), like the server. */
function dayRank(d: DaySpec): number {
  if (typeof d === 'number') return 0;
  if (WEEKDAYS.includes(d)) return 1;
  if (d === 'laborables' || d === 'fin_de_semana') return 2;
  return 3;
}

/** Table order: by moment of the day, then from the most specific day. */
export function sortAgenda(agenda: AgendaEntry[]): AgendaEntry[] {
  return [...agenda].sort((a, b) => MOMENTS.indexOf(a.momento) - MOMENTS.indexOf(b.momento) || dayRank(a.dia) - dayRank(b.dia)
    || (typeof a.dia === 'number' && typeof b.dia === 'number' ? a.dia - b.dia : 0));
}

const counted = (n: number, one: string, many: string, names: string[]) => `${n} ${n === 1 ? one : many} (${names.join(', ')})`;

/** What applying the agenda did, in one line for the GM. */
export function summaryText(s: ApplySummary): string {
  const parts: string[] = [];
  if (s.creados.length) parts.push(counted(s.creados.length, 'creado', 'creados', s.creados));
  if (s.movidos.length) parts.push(counted(s.movidos.length, 'movido', 'movidos', s.movidos));
  if (s.retirados.length) parts.push(counted(s.retirados.length, 'retirado', 'retirados', s.retirados));
  if (s.sin_cambios) parts.push(`${s.sin_cambios} sin cambios`);
  for (const k of s.saltados) parts.push(`saltado: ${k.nombre} (${k.motivo})`);
  return parts.length ? parts.join(' · ') : 'Ningún PNJ tenía nada que hacer a esta hora.';
}

/** Server validation problems of an agenda or sheet, if the error carries them. */
export function problemsOf(err: unknown): string[] {
  const data = (err as { response?: { data?: { problems?: unknown; error?: unknown } } })?.response?.data;
  if (Array.isArray(data?.problems)) return data.problems.map(String);
  if (typeof data?.error === 'string') return [data.error];
  return ['No se pudo guardar.'];
}
