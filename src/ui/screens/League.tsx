import { useState } from 'react';
import { computeStandings, stars } from '../../engine/season';
import { Stars, TeamBadge } from '../components/bits';
import { useGame } from '../store';

export function League() {
  const { league, results } = useGame();
  const [openTeam, setOpenTeam] = useState<string | null>(null);
  const table = computeStandings(league.teams, Object.values(results));
  const teamById = (id: string) => league.teams.find((t) => t.id === id)!;

  return (
    <section>
      <header className="screen-head">
        <h1>League</h1>
      </header>

      <h2>Standings</h2>
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
              const t = teamById(row.teamId);
              const rd = row.runsFor - row.runsAgainst;
              return (
                <tr key={row.teamId}>
                  <td className="muted">{i + 1}</td>
                  <td>
                    <span className="team-cell">
                      <TeamBadge team={t} size={24} /> <span className="city">{t.city}</span> <strong>{t.name}</strong>
                    </span>
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

      <h2>Teams</h2>
      <div className="team-list">
        {league.teams.map((t) => {
          const open = openTeam === t.id;
          return (
            <div key={t.id} className="card team-block" style={{ borderTopColor: t.colors[0] }}>
              <button className="team-head" onClick={() => setOpenTeam(open ? null : t.id)} aria-expanded={open}>
                <TeamBadge team={t} size={36} />
                <span>
                  <span className="muted">{t.city}</span>
                  <br />
                  <strong className="display">{t.name}</strong>
                </span>
                <span className="chev">{open ? '−' : '+'}</span>
              </button>
              {open && (
                <ul className="roster">
                  {[...t.lineup, ...t.rotation].map((id) => {
                    const p = league.players[id];
                    const pitcher = p.role === 'pitcher';
                    return (
                      <li key={id}>
                        <span className="pos">{p.position}</span>
                        <span className="pname">{p.name}</span>
                        <span className="pstars">
                          {pitcher ? (
                            <Stars value={stars(p, 'pitching')} label="Pitching" />
                          ) : (
                            <>
                              <Stars value={stars(p, 'batting')} label="Batting" />
                              <span className="star-sub muted">
                                RUN {stars(p, 'baserunning')} · DEF {stars(p, 'defense')}
                              </span>
                            </>
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
