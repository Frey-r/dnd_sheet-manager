import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { homebrewApi } from '../../services/api';
import { getApiError } from '../../services/errors';
import { MONSTER_SIZES, MONSTER_TYPES } from '../../services/srdService';
import { ErrorState } from '../ui/Feedback';
import type { MonsterAction, SRDMonster } from '../../types/srd';

const CRS = ['0', '1/8', '1/4', '1/2', ...Array.from({ length: 30 }, (_, index) => String(index + 1))];
const ABILITIES: ['str' | 'dex' | 'con' | 'int' | 'wis' | 'cha', string][] = [['str', 'FUE'], ['dex', 'DES'], ['con', 'CON'], ['int', 'INT'], ['wis', 'SAB'], ['cha', 'CAR']];

type Form = {
  name: string; size: string; type: string; alignment: string; ac: number; hp: number; hit_dice: string; cr: string; speed: number;
  str: number; dex: number; con: number; int: number; wis: number; cha: number;
  senses: string; languages: string; traits: string; actions: string; reactions: string; legendary_actions: string;
};

// Cada entrada se edita como una línea "Nombre: descripción".
const toLines = (entries: MonsterAction[] | null | undefined) => (entries ?? []).map((entry) => `${entry.name}: ${entry.desc}`).join('\n');
function fromLines(text: string): MonsterAction[] {
  return text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => {
    const at = line.indexOf(':');
    return at > 0 ? { name: line.slice(0, at).trim(), desc: line.slice(at + 1).trim() } : { name: line, desc: '' };
  });
}

function initialForm(monster?: SRDMonster): Form {
  const walk = Number.parseInt(String(monster?.speed?.walk ?? 30), 10);
  return {
    name: monster?.name ?? '', size: monster?.size ?? 'Medium', type: monster?.type ?? 'humanoid', alignment: monster?.alignment ?? 'neutral',
    ac: monster?.ac ?? 10, hp: monster?.hp ?? 10, hit_dice: monster?.hit_dice ?? '', cr: monster?.cr ?? '1', speed: Number.isFinite(walk) ? walk : 30,
    str: monster?.str ?? 10, dex: monster?.dex ?? 10, con: monster?.con ?? 10, int: monster?.int ?? 10, wis: monster?.wis ?? 10, cha: monster?.cha ?? 10,
    senses: monster?.senses ?? '', languages: monster?.languages ?? '',
    traits: toLines(monster?.traits), actions: toLines(monster?.actions), reactions: toLines(monster?.reactions), legendary_actions: toLines(monster?.legendary_actions),
  };
}

export function HomebrewMonsterForm({ initial, onSaved, onClose }: { initial?: SRDMonster; onSaved: (monster: SRDMonster) => void; onClose: () => void }) {
  const [form, setForm] = useState<Form>(() => initialForm(initial));
  const [error, setError] = useState('');
  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        speed: { walk: form.speed },
        traits: fromLines(form.traits), actions: fromLines(form.actions), reactions: fromLines(form.reactions), legendary_actions: fromLines(form.legendary_actions),
      };
      const response = initial ? await homebrewApi.update(initial.id, payload) : await homebrewApi.create(payload);
      return response.data as SRDMonster;
    },
    onSuccess: (monster) => onSaved(monster),
    onError: (reason) => setError(getApiError(reason, 'No se pudo guardar la criatura')),
  });
  const input = 'mt-1 w-full rounded bg-surface-subtle border-border-low-contrast';
  const text = (key: 'name' | 'alignment' | 'hit_dice' | 'senses' | 'languages' | 'type', label: string, extra?: { list?: string; required?: boolean }) => <label className="block text-sm font-label-bold">{label}<input required={extra?.required} list={extra?.list} value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} className={input} /></label>;
  const num = (key: 'ac' | 'hp' | 'speed' | 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha', label: string, min = 0) => <label className="block text-sm font-label-bold">{label}<input type="number" min={min} value={form[key]} onChange={(event) => setForm({ ...form, [key]: Number(event.target.value) })} className={input} /></label>;
  const lines = (key: 'traits' | 'actions' | 'reactions' | 'legendary_actions', label: string) => <label className="block text-sm font-label-bold">{label} <span className="font-normal text-secondary">(una por línea: «Nombre: descripción»)</span><textarea rows={3} value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} className={input} /></label>;

  return <div className="fixed inset-0 z-50 bg-black/50 p-4 flex items-center justify-center">
    <form onSubmit={(event) => { event.preventDefault(); save.mutate(); }} className="bg-surface w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-xl p-5 space-y-4">
      <h2 className="font-headline-md">{initial ? 'Editar criatura homebrew' : 'Nueva criatura homebrew'}</h2>
      {error && <ErrorState message={error} />}
      {text('name', 'Nombre', { required: true })}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <label className="block text-sm font-label-bold">Tamaño<select value={form.size} onChange={(event) => setForm({ ...form, size: event.target.value })} className={input}>{MONSTER_SIZES.map((size) => <option key={size}>{size}</option>)}</select></label>
        {text('type', 'Tipo', { list: 'homebrew-types' })}
        {text('alignment', 'Alineamiento')}
        <label className="block text-sm font-label-bold">Valor de desafío<select value={form.cr} onChange={(event) => setForm({ ...form, cr: event.target.value })} className={input}>{CRS.map((cr) => <option key={cr}>{cr}</option>)}</select></label>
      </div>
      <datalist id="homebrew-types">{MONSTER_TYPES.map((type) => <option key={type} value={type.toLowerCase()} />)}</datalist>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{num('ac', 'Clase de armadura')}{num('hp', 'Puntos de golpe', 1)}{text('hit_dice', 'Dados de golpe')}{num('speed', 'Velocidad (pies)')}</div>
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">{ABILITIES.map(([key, label]) => <div key={key}>{num(key, label, 1)}</div>)}</div>
      <div className="grid md:grid-cols-2 gap-3">{text('senses', 'Sentidos')}{text('languages', 'Idiomas')}</div>
      {lines('traits', 'Rasgos')}{lines('actions', 'Acciones')}{lines('reactions', 'Reacciones')}{lines('legendary_actions', 'Acciones legendarias')}
      <div className="flex justify-end gap-2"><button type="button" onClick={onClose} className="px-4 py-2 border rounded-lg">Cancelar</button><button type="submit" disabled={save.isPending} className="px-4 py-2 bg-primary-container text-on-primary-container rounded-lg font-label-bold">{save.isPending ? 'Guardando…' : 'Guardar'}</button></div>
    </form>
  </div>;
}
