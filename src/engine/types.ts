export type RatingKey =
  | 'contact' | 'power' | 'discipline' // batting
  | 'velocity' | 'control' | 'stuff'  // pitching
  | 'speed'                            // baserunning
  | 'defense';                         // defense

/** Hidden ratings, integers 0–100. */
export type Ratings = Record<RatingKey, number>;

export type StarGroup = 'batting' | 'pitching' | 'baserunning' | 'defense';

export type Role = 'batter' | 'pitcher';

export interface Player {
  id: string;
  name: string;
  teamId: string;
  role: Role;
  position: string;
  ratings: Ratings;
}

export interface Team {
  id: string;
  city: string;
  name: string;
  abbr: string;
  colors: [string, string];
  /** 9 batters, batting order. */
  lineup: string[];
  /** 4 pitchers, rotation order. */
  rotation: string[];
}

export interface League {
  seed: string;
  name: string;
  teams: Team[];
  players: Record<string, Player>;
}

export interface ScheduledGame {
  id: string;
  day: number;
  awayId: string;
  homeId: string;
}

export type Half = 'top' | 'bottom';
export type Bases = [string | null, string | null, string | null];

export type HitKind = 'single' | 'double' | 'triple' | 'homeRun';
export type OutKind = 'groundout' | 'flyout' | 'lineout' | 'popout';

interface EventBase {
  inning: number;
  half: Half;
  outs: number;
  balls: number;
  strikes: number;
  bases: Bases;
  score: { away: number; home: number };
}

export type GameEvent = EventBase & (
  | { kind: 'gameStart'; awayPitcherId: string; homePitcherId: string }
  | { kind: 'halfStart'; battingTeamId: string }
  | { kind: 'atBat'; batterId: string; pitcherId: string }
  | { kind: 'ball' | 'calledStrike' | 'swingingStrike' | 'foul'; batterId: string; pitcherId: string }
  | { kind: 'walk'; batterId: string; pitcherId: string }
  | { kind: 'strikeout'; batterId: string; pitcherId: string; swinging: boolean }
  | { kind: 'hit'; batterId: string; pitcherId: string; hit: HitKind }
  | { kind: 'out'; batterId: string; pitcherId: string; out: OutKind; sacrifice: boolean }
  | { kind: 'run'; runnerId: string; teamId: string }
  | { kind: 'halfEnd' }
  | { kind: 'gameEnd'; winnerId: string; loserId: string }
);

export interface GameResult {
  gameId: string;
  awayId: string;
  homeId: string;
  awayScore: number;
  homeScore: number;
  innings: number;
  events: GameEvent[];
}
