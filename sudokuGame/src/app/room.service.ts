import { Injectable, NgZone } from '@angular/core';
import { Subject } from 'rxjs';

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface RoomPlayer {
  id: string;
  name: string;
  isHost: boolean;
}

export interface GameRoom {
  id: string;
  code: string;
  name: string;
  isPublic: boolean;
  requireBoth: boolean;
  difficulty: Difficulty;
  hostId: string;
  players: RoomPlayer[];
  maxPlayers: number;
  round: number;
  puzzle: number[][] | null;
}

export const ROOM_API_URL = 'https://sudoku-game-server-latest.onrender.com';

interface RoomResult {
  room: GameRoom | null;
  error: string;
}

@Injectable({
  providedIn: 'root'
})
export class RoomService {
  private rooms: GameRoom[] = [];
  private names: string[] = [];
  private activeId: string | null = null;
  private snapshot = '';
  private missingPolls = 0;
  private readonly changed = new Subject<void>();
  readonly changes$ = this.changed.asObservable();
  offline = false;

  constructor(private zone: NgZone) {
    void this.poll();
    this.zone.runOutsideAngular(() => {
      window.setInterval(() => void this.poll(), 1000);
    });
  }

  watch(id: string | null): void {
    this.activeId = id;
  }

  listPublic(): GameRoom[] {
    return this.rooms.filter(room => room.isPublic).map(room => this.copy(room));
  }

  nameTaken(name: string): boolean {
    const key = name.trim().toLowerCase();
    return this.names.some(item => item.toLowerCase() === key);
  }

  getRoom(id: string): GameRoom | null {
    const room = this.rooms.find(item => item.id === id);
    return room ? this.copy(room) : null;
  }

  async create(name: string, isPublic: boolean, difficulty: Difficulty, host: RoomPlayer, requireBoth: boolean): Promise<RoomResult> {
    const result = await this.send('/rooms', {
      name,
      isPublic,
      difficulty,
      requireBoth,
      player: host
    });
    if (result.room) {
      this.watch(result.room.id);
      this.remember(result.room);
    }
    return result;
  }

  async join(id: string, player: RoomPlayer): Promise<RoomResult> {
    const result = await this.send('/rooms/join', { id, player });
    if (result.room) {
      this.watch(result.room.id);
      this.remember(result.room);
    }
    return result;
  }

  async joinByCode(code: string, player: RoomPlayer): Promise<RoomResult> {
    const result = await this.send('/rooms/join-by-code', { code, player });
    if (result.room) {
      this.watch(result.room.id);
      this.remember(result.room);
    }
    return result;
  }

  async joinPrivate(code: string, name: string, player: RoomPlayer): Promise<RoomResult> {
    const result = await this.send('/rooms/join-private', { code, name, player });
    if (result.room) {
      this.watch(result.room.id);
      this.remember(result.room);
    }
    return result;
  }

  async publishPuzzle(roomId: string, puzzle: number[][], hostId: string): Promise<GameRoom | null> {
    const result = await this.send('/rooms/' + roomId + '/puzzle', { puzzle, hostId });
    if (!result.room) {
      return null;
    }
    this.remember(result.room);
    return this.copy(result.room);
  }

  async leave(id: string, playerId: string): Promise<void> {
    this.watch(null);
    this.rooms = this.rooms.filter(room => room.id !== id);
    this.snapshot = '';
    try {
      await fetch(ROOM_API_URL + '/rooms/' + id + '/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId })
      });
    } catch {
      this.offline = true;
    }
    this.changed.next();
  }

  private async poll(): Promise<void> {
    const activeId = this.activeId;
    try {
      const [publicResponse, nameResponse, activeResponse] = await Promise.all([
        fetch(ROOM_API_URL + '/rooms/public'),
        fetch(ROOM_API_URL + '/rooms/names'),
        activeId ? fetch(ROOM_API_URL + '/rooms/' + activeId) : Promise.resolve(null)
      ]);
      if (!publicResponse.ok || !nameResponse.ok) {
        this.markOffline();
        return;
      }
      const publicBody = await publicResponse.json() as { rooms?: GameRoom[] };
      const nameBody = await nameResponse.json() as { names?: string[] };
      let active: GameRoom | null = null;
      let activeMissing = false;
      if (activeResponse) {
        if (activeResponse.status === 404) {
          this.missingPolls += 1;
          if (this.missingPolls < 2) {
            active = this.rooms.find(room => room.id === activeId) ?? null;
          } else {
            activeMissing = true;
          }
        } else if (activeResponse.ok) {
          this.missingPolls = 0;
          const activeBody = await activeResponse.json() as RoomResult;
          active = this.asRoom(activeBody.room);
        }
      }
      const next = (publicBody.rooms ?? []).map(room => this.asRoom(room)).filter((room): room is GameRoom => !!room);
      const joined = active;
      if (joined) {
        const index = next.findIndex(room => room.id === joined.id);
        if (index >= 0) {
          next[index] = joined;
        } else {
          next.push(joined);
        }
      } else if (activeMissing && activeId) {
        const kept = next.filter(room => room.id !== activeId);
        next.length = 0;
        next.push(...kept);
      }
      const names = (nameBody.names ?? []).filter(name => typeof name === 'string');
      const offline = false;
      const snapshot = JSON.stringify({ next, names, offline });
      if (snapshot === this.snapshot) {
        return;
      }
      this.snapshot = snapshot;
      this.rooms = next;
      this.names = names;
      this.offline = false;
      this.zone.run(() => this.changed.next());
    } catch {
      this.markOffline();
    }
  }

  private markOffline(): void {
    if (this.offline) {
      return;
    }
    this.offline = true;
    this.snapshot = '';
    this.zone.run(() => this.changed.next());
  }

  private async send(path: string, body: unknown): Promise<RoomResult> {
    try {
      const response = await fetch(ROOM_API_URL + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const result = await response.json() as RoomResult;
      this.offline = false;
      return {
        room: this.asRoom(result.room),
        error: result.error || (response.ok ? '' : 'The game server could not complete that.')
      };
    } catch {
      this.offline = true;
      this.changed.next();
      return { room: null, error: 'The game server is not running.' };
    }
  }

  private remember(room: GameRoom): void {
    const index = this.rooms.findIndex(item => item.id === room.id);
    if (index >= 0) {
      this.rooms[index] = this.copy(room);
    } else {
      this.rooms.push(this.copy(room));
    }
    if (!this.names.some(name => name.toLowerCase() === room.name.toLowerCase())) {
      this.names.push(room.name);
    }
    this.snapshot = '';
    this.changed.next();
  }

  private asRoom(room: GameRoom | null | undefined): GameRoom | null {
    if (!room
      || typeof room.id !== 'string'
      || typeof room.code !== 'string'
      || typeof room.hostId !== 'string'
      || !Array.isArray(room.players)
      || room.players.some(player => !player || typeof player.id !== 'string' || typeof player.name !== 'string')) {
      return null;
    }
    return this.copy(room);
  }

  private copy(room: GameRoom): GameRoom {
    return {
      ...room,
      players: room.players.map(player => ({ ...player })),
      puzzle: room.puzzle ? room.puzzle.map(row => [...row]) : null
    };
  }
}
