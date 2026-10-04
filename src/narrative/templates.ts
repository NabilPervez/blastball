import { playByPlay } from '../../content/narrative/templates.json';

/**
 * Data-driven narrative templates (PRD 2 §E10). Loaded and validated once; a bad template
 * (unknown `on`, unknown `when` key, unknown `{variable}`) throws on load, in dev and in tests.
 */

/** Every event kind a play-by-play template can target. Includes engine v2 kinds (unused until Sprint 12). */
export const TEMPLATE_KINDS = [
  'gameStart', 'halfStart', 'atBat', 'ball', 'calledStrike', 'swingingStrike', 'foul', 'walk', 'strikeout',
  'hit.single', 'hit.double', 'hit.triple', 'hit.homeRun',
  'out.groundout', 'out.flyout', 'out.lineout', 'out.popout',
  'run', 'halfEnd', 'gameEnd',
  'stealAttempt', 'pickoff', 'error', 'doublePlay', 'wildPitch', 'hitByPitch',
] as const;
export type TemplateKind = (typeof TEMPLATE_KINDS)[number];

export const CONTEXT_KEYS = [
  'inning', 'late', 'extra', 'margin', 'close', 'blowout', 'walkoff', 'goAhead', 'tying', 'rivalry', 'mod',
  'milestone', 'count', 'basesLoaded', 'risp', 'favorite', 'env', 'swinging', 'sacrifice', 'success',
] as const;
export type ContextKey = (typeof CONTEXT_KEYS)[number];
export type ContextValue = boolean | number | string | null;
export type NarrativeContext = Record<ContextKey, ContextValue>;

export const PLAY_VARIABLES = ['b', 'p', 'p2', 'r', 'f', 't', 'opp', 'stadium', 'mod', 'env', 'n', 'score', 'count', 'half', 'inning', 'base'] as const;
export type PlayVariable = (typeof PLAY_VARIABLES)[number];

export interface PlayTemplate {
  id: string;
  on: TemplateKind;
  when?: Partial<Record<ContextKey, ContextValue>>;
  weight: number;
  text: string;
}

const VAR_RE = /\{(\w+)\}/g;
export const templateVariables = (text: string) => [...text.matchAll(VAR_RE)].map((m) => m[1]);

export function validateTemplates(input: unknown): PlayTemplate[] {
  const doc = input as { playByPlay?: unknown };
  if (!doc || !Array.isArray(doc.playByPlay)) throw new Error('templates: missing playByPlay array');
  const kinds = new Set<string>(TEMPLATE_KINDS);
  const keys = new Set<string>(CONTEXT_KEYS);
  const vars = new Set<string>(PLAY_VARIABLES);
  const ids = new Set<string>();
  return doc.playByPlay.map((t: PlayTemplate, i: number) => {
    const where = `templates: playByPlay[${i}] (${t?.id})`;
    if (typeof t?.id !== 'string' || !t.id) throw new Error(`${where}: missing id`);
    if (ids.has(t.id)) throw new Error(`${where}: duplicate id`);
    ids.add(t.id);
    if (!kinds.has(t.on)) throw new Error(`${where}: unknown on "${t.on}"`);
    if (typeof t.text !== 'string' || !t.text.trim()) throw new Error(`${where}: empty text`);
    if (!Number.isInteger(t.weight) || t.weight < 1) throw new Error(`${where}: weight must be a positive integer`);
    for (const k of Object.keys(t.when ?? {})) if (!keys.has(k)) throw new Error(`${where}: unknown when key "${k}"`);
    for (const v of templateVariables(t.text)) if (!vars.has(v)) throw new Error(`${where}: unknown variable {${v}}`);
    return t;
  });
}

/** Templates grouped by event kind. */
export const PLAY_TEMPLATES: Record<TemplateKind, PlayTemplate[]> = (() => {
  const byKind = Object.fromEntries(TEMPLATE_KINDS.map((k) => [k, [] as PlayTemplate[]])) as Record<TemplateKind, PlayTemplate[]>;
  for (const t of validateTemplates({ playByPlay })) byKind[t.on].push(t);
  return byKind;
})();
