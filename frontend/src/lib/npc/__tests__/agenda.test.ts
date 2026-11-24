// @vitest-environment node
/* T-27 · U1 — labels and helpers of the NPC agenda (npc-agenda.md §2). */
import { describe, expect, it } from 'vitest';
import { clockLabel, dayLabel, describeEntry, momentLabel, sortAgenda, summaryText, upsertEntry, type AgendaEntry } from '../agenda';

const scenes = [{ id: 5, name: 'Muralla' }, { id: 7, name: 'Cuartel' }];

describe('labels', () => {
  it('days', () => {
    expect(dayLabel(3)).toBe('Día 3');
    expect(dayLabel('todos')).toBe('Todos los días');
    expect(dayLabel('laborables')).toBe('Laborables (lun–vie)');
    expect(dayLabel('fin_de_semana')).toBe('Fin de semana');
    expect(dayLabel('miercoles')).toBe('Miércoles');
    expect(dayLabel('sabado')).toBe('Sábado');
  });
  it('moments and the clock', () => {
    expect(momentLabel('dia')).toBe('Día');
    expect(momentLabel('tarde')).toBe('Tarde');
    expect(momentLabel('noche')).toBe('Noche');
    expect(clockLabel({ game_day: 3, time_of_day: 'noche', weekday: 'miercoles', first_weekday: 'lunes' })).toBe('Día 3 · miércoles · Noche');
  });
});

describe('describeEntry', () => {
  it('a patrol, a standing NPC, an away NPC and a broken scene', () => {
    expect(describeEntry({ dia: 'todos', momento: 'dia', ubicacion: { escena_id: 5 }, path: { mode: 'loop', points: [{ x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 }] } }, scenes))
      .toBe('Muralla · patrulla de 3 puntos');
    expect(describeEntry({ dia: 2, momento: 'tarde', ubicacion: { escena_id: 5 }, path: { mode: 'pingpong', points: [{ x: 1, y: 1 }, { x: 2, y: 2 }] } }, scenes))
      .toBe('Muralla · ida y vuelta (2 puntos)');
    expect(describeEntry({ dia: 2, momento: 'tarde', ubicacion: { escena_id: 5 }, path: { mode: 'once', points: [{ x: 1, y: 1 }, { x: 2, y: 2 }] } }, scenes))
      .toBe('Muralla · ida (2 puntos)');
    expect(describeEntry({ dia: 'todos', momento: 'noche', ubicacion: { escena_id: 7 }, posicion: { x: 70, y: 70 }, path: null, oculto: true }, scenes))
      .toBe('Cuartel · quieto en (70, 70) · oculto');
    expect(describeEntry({ dia: 'domingo', momento: 'noche', ubicacion: null }, scenes)).toBe('Ausente (fuera de los mapas)');
    expect(describeEntry({ dia: 1, momento: 'dia', ubicacion: { escena_id: 99 }, posicion: { x: 1, y: 1 } }, scenes)).toBe('Escena borrada (99)');
  });
});

describe('upsertEntry and sortAgenda', () => {
  const a: AgendaEntry[] = [
    { dia: 'todos', momento: 'noche', ubicacion: null },
    { dia: 3, momento: 'dia', ubicacion: null },
    { dia: 'todos', momento: 'dia', ubicacion: null },
    { dia: 'laborables', momento: 'dia', ubicacion: null },
    { dia: 'lunes', momento: 'dia', ubicacion: null },
  ];
  it('replaces the entry with the same day and moment, or appends', () => {
    const replaced = upsertEntry(a, { dia: 'todos', momento: 'noche', ubicacion: { escena_id: 7 }, posicion: { x: 1, y: 1 } });
    expect(replaced).toHaveLength(5);
    expect(replaced[0].ubicacion).toEqual({ escena_id: 7 });
    expect(upsertEntry(a, { dia: 'todos', momento: 'tarde', ubicacion: null })).toHaveLength(6);
    expect(a[0].ubicacion).toBeNull(); // immutable
  });
  it('orders by moment, then from the most specific day', () => {
    expect(sortAgenda(a).map((e) => `${e.momento}:${e.dia}`)).toEqual(['dia:3', 'dia:lunes', 'dia:laborables', 'dia:todos', 'noche:todos']);
  });
});

describe('summaryText', () => {
  it('lists what moved and what was skipped', () => {
    expect(summaryText({ creados: ['Brom'], movidos: ['Mira', 'Vex'], retirados: [], sin_cambios: 2, saltados: [{ nombre: 'Kael', motivo: 'sigue en combate en Muralla' }] }))
      .toBe('1 creado (Brom) · 2 movidos (Mira, Vex) · 2 sin cambios · saltado: Kael (sigue en combate en Muralla)');
    expect(summaryText({ creados: [], movidos: [], retirados: [], sin_cambios: 0, saltados: [] })).toBe('Ningún PNJ tenía nada que hacer a esta hora.');
  });
});
