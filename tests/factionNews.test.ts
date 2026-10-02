import { describe, expect, it } from 'vitest';
import { tally, winnerOf } from '../src/world/elections';
import { NAMED_AFTER_VOTES, opinionLabel, reactToElection } from '../src/world/factionNews';
import { createUniverse, currentElection, reduce, runCommand, type UniverseSettings, type UniverseState } from '../src/world/universe';

const settings = (seed: string): UniverseSettings => ({ name: 'F', seed, leagueSize: 8, seasonLength: 20, chaos: 'normal', timeMode: 'manual', dayLengthMinutes: 60 });
const fan = { kind: 'organizer' as const, fanName: 'Robin', favoriteTeamId: null };

describe('faction reactions', () => {
  it('every election result gets faction reactions in the news', () => {
    const u = runCommand(createUniverse('f', settings('react'), 0), { type: 'simDays', count: 7 }).state;
    const reactions = u.news.filter((n) => n.factionId);
    expect(reactions.length).toBeGreaterThanOrEqual(1);
    expect(u.factions.map((f) => f.id)).toContain(reactions[0].factionId);
  });

  it('factions warm to players who vote their way and cool on those who do not', () => {
    let u: UniverseState = { ...createUniverse('f', settings('opinion'), 0, fan), coins: 1000 };
    const e = currentElection(u)!;
    const pick = winnerOf(tally(e));
    u = reduce(u, { type: 'votesBought', electionId: e.id, proposal: pick, count: 3 });
    u = runCommand(u, { type: 'simDays', count: 7 }).state;
    for (const f of u.factions) {
      const theirs = e.factionVotes[f.id].indexOf(Math.max(...e.factionVotes[f.id]));
      expect(u.factionOpinion[f.id]).toBe(theirs === pick ? 1 : -1);
    }
  });

  it('factions only name the player once they have real influence (or swung a vote)', () => {
    const u = createUniverse('f', settings('named'), 0, fan);
    const e = { ...currentElection(u)!, playerVotes: [0, 2, 0] };
    const quiet = reactToElection(u.factions, e, 1, false, { persona: fan, lifetimeVotes: 2, opinion: {} }, 'seed');
    expect(quiet.news.some((n) => n.text.includes('Robin'))).toBe(false);
    const famous = reactToElection(u.factions, e, 1, true, { persona: fan, lifetimeVotes: NAMED_AFTER_VOTES, opinion: {} }, 'seed');
    expect(famous.news.some((n) => n.text.includes('the Organizer Robin'))).toBe(true);
  });

  it('opinions stay within -5..5 and have readable labels', () => {
    const u = createUniverse('f', settings('clamp'), 0, fan);
    let opinion: Record<string, number> = {};
    const e = { ...currentElection(u)!, playerVotes: [5, 0, 0] };
    for (let i = 0; i < 20; i++) opinion = reactToElection(u.factions, e, 0, false, { persona: fan, lifetimeVotes: 0, opinion }, `s${i}`).opinion;
    for (const v of Object.values(opinion)) {
      expect(v).toBeGreaterThanOrEqual(-5);
      expect(v).toBeLessThanOrEqual(5);
    }
    expect(opinionLabel(5)).toBe('Adores you');
    expect(opinionLabel(0)).toBe('Neutral');
    expect(opinionLabel(-5)).toBe('Despises you');
  });

  it('sponsoring a team pleases its fans and annoys the Purists', () => {
    let u = runCommand(runCommand(createUniverse('f', settings('patron'), 0, fan), { type: 'simToSeasonEnd' }).state, { type: 'endDay' }).state;
    u = { ...u, coins: 500 };
    const team = u.factions.find((f) => f.id === 'loyalists')!.favoriteTeams[0];
    const after = reduce(u, { type: 'patronSponsored', teamId: team });
    expect(after.factionOpinion.loyalists).toBe(2);
    if (!u.factions.find((f) => f.id === 'purists')!.favoriteTeams.includes(team)) expect(after.factionOpinion.purists).toBe(-1);
    expect(after.news.some((n) => n.factionId === 'purists' && n.text.includes('buy the Cup'))).toBe(true);
  });

  it('the champion gets a faction reaction', () => {
    const u = runCommand(createUniverse('f', settings('champ'), 0), { type: 'simToSeasonEnd' }).state;
    const last = u.news.filter((n) => n.factionId).at(-1)!;
    const champ = u.league.teams.find((t) => t.id === u.playoffs!.championId)!;
    expect(last.text).toContain(champ.name);
  });

  it('is deterministic', () => {
    const a = runCommand(createUniverse('f', settings('det'), 0), { type: 'simToSeasonEnd' }).state.news;
    const b = runCommand(createUniverse('f', settings('det'), 0), { type: 'simToSeasonEnd' }).state.news;
    expect(a).toEqual(b);
  });
});
