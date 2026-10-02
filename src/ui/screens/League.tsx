import { useState } from 'react';
import { avg, emptyLine, era, inningsPitched, type StatLine } from '../../engine/boxScore';
import type { Player } from '../../engine/types';
import { analystReveal } from '../../world/persona';
import { rarityOf } from '../../world/rarity';
import { standingsOf, type UniverseState } from '../../world/universe';
import { TeamBadge } from '../components/bits';
import { PlayerCard } from '../components/PlayerCard';
import { ModList, playerModsOf, stadiumModsOf } from '../components/Mods';
import { PatronPanel } from '../components/SeasonBits';
import { Leaders, PickButtons } from '../components/FanFeatures';
import { useGame } from '../store';

const teamOf = (u: UniverseState, id: string) => u.league.teams.find((t) => t.id === id)!;

const STATUS_LABEL: Record<string, string> = { active: 'Active', departed: 'Departed', returned: 'Returned', reserve: 'Reserve', retired: 'Retired' };

/** One row per finished season the player appeared in. */
function SeasonByseason({ u, player }: { u: UniverseState; player: Player }) {
  const seasons = Object.entries(u.statsBySeason)
    .map(([season, lines]) => [Number(season), lines[player.id]] as const)
    .filter(([, line]) => line && line.g > 0);
  if (!seasons.length) return null;
  const pitcher = player.role === 'pitcher';
  return (
    <>
      <h2>By season</h2>
      <div className="card table-wrap">
        <table className="stat-table">
          <thead>
            <tr>
              <th scope="col">Season</th>
              {pitcher ? (
                <>
                  <th scope="col">W-L</th>
                  <th scope="col">ERA</th>
                  <th scope="col">K</th>
                </>
              ) : (
                <>
                  <th scope="col">G</th>
                  <th scope="col">AVG</th>
                  <th scope="col">HR</th>
                  <th scope="col">R</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {seasons.map(([season, s]) => (
              <tr key={season}>
                <th scope="row">{season}</th>
                {pitcher ? (
                  <>
                    <td>
                      {s.w}-{s.l}
                    </td>
                    <td>{era(s)}</td>
                    <td>{s.pk}</td>
                  </>
                ) : (
                  <>
                    <td>{s.g}</td>
                    <td>{avg(s)}</td>
                    <td>{s.hr}</td>
                    <td>{s.r}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function HallOfTheDeparted({ u }: { u: UniverseState }) {
  const showDetail = useGame((s) => s.showDetail);
  const gone = u.weird.departed.filter((d) => u.weird.playerStatus[d.playerId] === 'departed');
  if (!u.weird.departed.length) return null;
  return (
    <>
      <h2>Hall of the Departed</h2>
      {gone.length === 0 ? (
        <p className="muted">Empty, for now. Everyone who left has come back.</p>
      ) : (
        <div className="card-grid">
          {gone.map((d) => (
            <PlayerCard
              key={d.playerId}
              player={u.league.players[d.playerId]}
              team={teamOf(u, d.teamId)}
              rarity="departed"
              onOpen={() => showDetail({ kind: 'player', id: d.playerId })}
              extra={<span className="muted small">Season {d.season}, day {d.day}</span>}
            />
          ))}
        </div>
      )}
    </>
  );
}

/** The Analyst persona sees one extra hidden rating on each card. */
function analystExtra(u: UniverseState, player: Player) {
  if (u.persona?.kind !== 'analyst') return undefined;
  const r = analystReveal(player);
  return (
    <span className="pc-analyst" title="Hidden rating (Analyst perk)">
      ◎ {r.label} <strong>{r.value}</strong>
    </span>
  );
}

function Standings({ u }: { u: UniverseState }) {
  const showDetail = useGame((s) => s.showDetail);
  const table = standingsOf(u);
  return (
    <div className="card table-wrap">
      <table className="standings">
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col">Team</th>
            <th scope="col">W</th>
            <th scope="col">L</th>
            <th scope="col">RD</th>
          </tr>
        </thead>
        <tbody>
          {table.map((row, i) => {
            const t = teamOf(u, row.teamId);
            const rd = row.runsFor - row.runsAgainst;
            return (
              <tr key={row.teamId}>
                <td className="muted">{i + 1}</td>
                <td>
                  <button className="team-cell link-row" onClick={() => showDetail({ kind: 'team', id: t.id })}>
                    <TeamBadge team={t} size={24} /> <span className="city">{t.city}</span> <strong>{t.name}</strong>
                  </button>
                </td>
                <td>{row.wins}</td>
                <td>{row.losses}</td>
                <td className={rd > 0 ? 'pos' : rd < 0 ? 'neg' : ''}>{rd > 0 ? `+${rd}` : rd}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Search({ u }: { u: UniverseState }) {
  const showDetail = useGame((s) => s.showDetail);
  const [q, setQ] = useState('');
  const term = q.trim().toLowerCase();
  const players = term ? Object.values(u.league.players).filter((p) => p.name.toLowerCase().includes(term)).slice(0, 12) : [];
  const teams = term ? u.league.teams.filter((t) => `${t.city} ${t.name}`.toLowerCase().includes(term)) : [];
  return (
    <div className="search">
      <label htmlFor="search" className="sr-only">
        Search players and teams
      </label>
      <input id="search" className="field" type="search" placeholder="Search players & teams" value={q} onChange={(e) => setQ(e.target.value)} />
      {term && (
        <ul className="search-results card">
          {teams.map((t) => (
            <li key={t.id}>
              <button onClick={() => showDetail({ kind: 'team', id: t.id })}>
                <TeamBadge team={t} size={22} /> {t.city} <strong>{t.name}</strong>
              </button>
            </li>
          ))}
          {players.map((p) => (
            <li key={p.id}>
              <button onClick={() => showDetail({ kind: 'player', id: p.id })}>
                <TeamBadge team={teamOf(u, p.teamId)} size={22} /> {p.name} <span className="muted">· {p.position}</span>
              </button>
            </li>
          ))}
          {!teams.length && !players.length && <li className="muted empty">No matches.</li>}
        </ul>
      )}
    </div>
  );
}

function TeamPage({ u, teamId }: { u: UniverseState; teamId: string }) {
  const showDetail = useGame((s) => s.showDetail);
  const team = teamOf(u, teamId);
  const row = standingsOf(u).find((r) => r.teamId === teamId)!;
  const reserves = Object.entries(u.weird.playerStatus)
    .filter(([id, st]) => st === 'reserve' && u.league.players[id].teamId === teamId)
    .map(([id]) => id);
  const grid = (ids: string[]) => (
    <div className="card-grid">
      {ids.map((id) => (
        <PlayerCard key={id} player={u.league.players[id]} team={team} rarity={rarityOf(u, id)} extra={analystExtra(u, u.league.players[id])} mods={playerModsOf(u, id)} onOpen={() => showDetail({ kind: 'player', id })} />
      ))}
    </div>
  );
  return (
    <section>
      <button className="link-btn" onClick={() => showDetail(null)}>
        ← League
      </button>
      <header className="team-hero card" style={{ borderTopColor: team.colors[0] }}>
        <TeamBadge team={team} size={56} />
        <div>
          <p className="muted">{team.city}</p>
          <h1 className="display">{team.name}</h1>
          <p className="muted">
            {row.wins}–{row.losses} · {row.runsFor} runs scored, {row.runsAgainst} allowed
          </p>
        </div>
      </header>
      <PatronPanel teamId={teamId} />
      <h2>Lineup</h2>
      {grid(team.lineup)}
      <h2>Rotation</h2>
      {grid(team.rotation)}
      {reserves.length > 0 && (
        <>
          <h2>Reserves</h2>
          <p className="muted small">Players who lost their spot when someone came back from the Departed.</p>
          {grid(reserves)}
        </>
      )}
      <h2>Home stadium</h2>
      <div className="card pad stack">
        <strong className="display">{u.weird.stadiums[teamId]?.name ?? 'Unknown grounds'}</strong>
        <ModList mods={stadiumModsOf(u, teamId)} currentDay={u.currentDay} />
      </div>
    </section>
  );
}

export function StatTable({ player, season, career }: { player: Player; season: StatLine; career: StatLine }) {
  const rows: [string, StatLine][] = [
    ['Season', season],
    ['Career', career],
  ];
  const pitcher = player.role === 'pitcher';
  const cols: [string, (s: StatLine) => string | number][] = pitcher
    ? [
        ['GS', (s) => s.gs],
        ['W-L', (s) => `${s.w}-${s.l}`],
        ['IP', inningsPitched],
        ['ERA', era],
        ['K', (s) => s.pk],
        ['BB', (s) => s.pbb],
      ]
    : [
        ['G', (s) => s.g],
        ['AVG', avg],
        ['H', (s) => s.h],
        ['HR', (s) => s.hr],
        ['R', (s) => s.r],
        ['BB', (s) => s.bb],
        ['K', (s) => s.k],
      ];
  return (
    <table className="stat-table">
      <thead>
        <tr>
          <th scope="col">
            <span className="sr-only">Span</span>
          </th>
          {cols.map(([h]) => (
            <th key={h} scope="col">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map(([label, s]) => (
          <tr key={label}>
            <th scope="row">{label}</th>
            {cols.map(([h, f]) => (
              <td key={h}>{f(s)}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Timeline({ u, playerId }: { u: UniverseState; playerId: string }) {
  const log = u.playerLog[playerId] ?? [];
  const team = teamOf(u, u.league.players[playerId].teamId);
  return (
    <ol className="timeline">
      <li>
        <span className="muted small">Season 1 · Day 1</span> Joined the {team.city} {team.name}.
      </li>
      {log.map((e, i) => (
        <li key={i}>
          <span className="muted small">
            Season {e.season} · Day {e.day}
          </span>{' '}
          {e.text}
        </li>
      ))}
    </ol>
  );
}

function PlayerPage({ u, playerId }: { u: UniverseState; playerId: string }) {
  const showDetail = useGame((s) => s.showDetail);
  const player = u.league.players[playerId];
  const team = teamOf(u, player.teamId);
  const season = u.seasonStats[playerId] ?? emptyLine();
  const career = u.careerStats[playerId] ?? emptyLine();
  const departure = u.weird.playerStatus[playerId] === 'departed' ? [...u.weird.departed].reverse().find((d) => d.playerId === playerId) : undefined;
  return (
    <section>
      <button className="link-btn" onClick={() => showDetail({ kind: 'team', id: team.id })}>
        ← {team.name}
      </button>
      <div className="player-page">
        <PlayerCard
          player={player}
          team={team}
          rarity={rarityOf(u, playerId)}
          size="lg"
          extra={analystExtra(u, player)}
          mods={playerModsOf(u, playerId)}
          back={
            <div className="pc-back-body">
              <strong className="display">{player.name}</strong>
              <StatTable player={player} season={season} career={career} />
              <p className="muted small">{(u.playerLog[playerId] ?? []).length} notable moments</p>
            </div>
          }
        />
        <div className="player-info">
          <h1 className="display">{player.name}</h1>
          <p className="muted">
            {player.position} · {team.city} {team.name} · {STATUS_LABEL[u.weird.playerStatus[playerId] ?? 'active']}
            {u.ages[playerId] !== undefined && ` · age ${u.ages[playerId]}`}
          </p>
          {departure && (
            <p className="departed-note">
              Departed on season {departure.season}, day {departure.day}: {player.name} {departure.cause}
            </p>
          )}
          {u.persona && !['departed', 'retired'].includes(u.weird.playerStatus[playerId] ?? '') && <PickButtons player={player} />}
          <h2>Modifiers</h2>
          <ModList mods={playerModsOf(u, playerId)} currentDay={u.currentDay} />
          <h2>Stats</h2>
          <div className="card table-wrap">
            <StatTable player={player} season={season} career={career} />
          </div>
          <SeasonByseason u={u} player={player} />
          <h2>Life timeline</h2>
          <Timeline u={u} playerId={playerId} />
        </div>
      </div>
    </section>
  );
}

export function League() {
  const u = useGame((s) => s.u)!;
  const detail = useGame((s) => s.detail);
  const showDetail = useGame((s) => s.showDetail);

  if (detail?.kind === 'team') return <TeamPage key={detail.id} u={u} teamId={detail.id} />;
  if (detail?.kind === 'player') return <PlayerPage key={detail.id} u={u} playerId={detail.id} />;

  return (
    <section>
      <header className="screen-head">
        <h1>League</h1>
      </header>
      <Search u={u} />
      <h2>Standings</h2>
      <Standings u={u} />
      <Leaders />
      <HallOfTheDeparted u={u} />
      <h2>Teams</h2>
      <div className="team-tiles">
        {u.league.teams.map((t) => (
          <button key={t.id} className="card team-tile" style={{ borderTopColor: t.colors[0] }} onClick={() => showDetail({ kind: 'team', id: t.id })}>
            <TeamBadge team={t} size={36} />
            <span>
              <span className="muted small">{t.city}</span>
              <br />
              <strong className="display">{t.name}</strong>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
