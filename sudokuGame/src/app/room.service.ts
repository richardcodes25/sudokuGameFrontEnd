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

const STORAGE_KEY = 'sudoku-rooms';

@Injectable({
  providedIn: 'root'
})
export class RoomService {
  private rooms: GameRoom[] = [];
  private nextId = 4;
  private readonly changed = new Subject<void>();
  readonly changes$ = this.changed.asObservable();

  constructor(private zone: NgZone) {
    this.rooms = this.readStored() ?? this.seedRooms();
    this.syncNextId();
    this.persist(false);
    window.addEventListener('storage', (event) => {
      if (event.key !== STORAGE_KEY || !event.newValue) {
        return;
      }
      const stored = this.parse(event.newValue);
      if (!stored) {
        return;
      }
      this.rooms = stored;
      this.syncNextId();
      this.zone.run(() => this.changed.next());
    });
  }

  listPublic(): GameRoom[] {
    this.reload();
    return this.rooms.filter(room => room.isPublic).map(room => this.copy(room));
  }

  nameTaken(name: string): boolean {
    this.reload();
    const key = name.trim().toLowerCase();
    return this.rooms.some(room => room.name.toLowerCase() === key);
  }

  create(name: string, isPublic: boolean, difficulty: Difficulty, host: RoomPlayer, requireBoth: boolean): GameRoom {
    this.reload();
    const room: GameRoom = {
      id: 'room-' + this.nextId++,
      code: this.makeCode(),
      name: name.trim(),
      isPublic,
      requireBoth,
      difficulty,
      hostId: host.id,
      players: [{ id: host.id, name: host.name, isHost: true }],
      maxPlayers: 5,
      round: 0,
      puzzle: null
    };
    this.rooms.push(room);
    this.persist(true);
    return this.copy(room);
  }

  join(id: string, player: RoomPlayer): string {
    this.reload();
    const room = this.rooms.find(item => item.id === id);
    if (!room) {
      return 'That room is no longer open.';
    }
    if (room.players.some(item => item.id === player.id)) {
      return '';
    }
    if (room.players.length >= room.maxPlayers) {
      return 'This room is full.';
    }
    room.players.push({ id: player.id, name: player.name, isHost: false });
    this.persist(true);
    return '';
  }

  joinByCode(code: string, player: RoomPlayer): { room: GameRoom | null; error: string } {
    this.reload();
    const key = code.trim();
    const room = this.rooms.find(item => item.code === key);
    if (!room) {
      return { room: null, error: 'No room uses that ID.' };
    }
    if (room.requireBoth) {
      return { room: null, error: 'This room requires both the room ID and the room name.' };
    }
    const error = this.join(room.id, player);
    return { room: error ? null : this.copy(this.rooms.find(item => item.id === room.id) as GameRoom), error };
  }

  joinPrivate(code: string, name: string, player: RoomPlayer): { room: GameRoom | null; error: string } {
    this.reload();
    const codeKey = code.trim();
    const nameKey = name.trim().toLowerCase();
    if (!codeKey && !nameKey) {
      return { room: null, error: 'Enter a room ID or a room name.' };
    }
    const byCode = codeKey ? this.rooms.find(item => item.code === codeKey) : undefined;
    const byName = nameKey ? this.rooms.find(item => item.name.toLowerCase() === nameKey) : undefined;
    if (codeKey && !byCode) {
      return { room: null, error: 'No room uses that ID.' };
    }
    if (nameKey && !byName) {
      return { room: null, error: 'No room uses that name.' };
    }
    if (byCode && byName && byCode.id !== byName.id) {
      return { room: null, error: 'That room ID and room name do not match.' };
    }
    const room = (byCode ?? byName) as GameRoom;
    if (room.requireBoth && (!byCode || !byName)) {
      return { room: null, error: 'This room requires both the room ID and the room name.' };
    }
    if (!room.requireBoth && byName && !byCode && room.isPublic) {
      return { room: null, error: 'That room is public. Join it from the list.' };
    }
    const error = this.join(room.id, player);
    return { room: error ? null : this.copy(this.rooms.find(item => item.id === room.id) as GameRoom), error };
  }

  getRoom(id: string): GameRoom | null {
    const room = this.rooms.find(item => item.id === id);
    return room ? this.copy(room) : null;
  }

  publishPuzzle(roomId: string, puzzle: number[][], hostId: string): GameRoom | null {
    this.reload();
    const room = this.rooms.find(item => item.id === roomId);
    if (!room || room.hostId !== hostId) {
      return null;
    }
    room.puzzle = puzzle.map(row => [...row]);
    room.round += 1;
    this.persist(true);
    return this.copy(room);
  }

  leave(id: string, playerId: string): void {
    this.reload();
    const room = this.rooms.find(item => item.id === id);
    if (!room) {
      return;
    }
    const leaving = room.players.find(item => item.id === playerId);
    room.players = room.players.filter(item => item.id !== playerId);
    if (room.players.length === 0) {
      this.rooms = this.rooms.filter(item => item.id !== id);
    } else if (leaving?.isHost) {
      room.players[0].isHost = true;
      room.hostId = room.players[0].id;
    }
    this.persist(true);
  }

  private seedRooms(): GameRoom[] {
    return [];
  }

  private makeCode(): string {
    let code = '';
    do {
      code = String(Math.floor(100000 + Math.random() * 900000));
    } while (this.rooms.some(room => room.code === code));
    return code;
  }

  private reload(): void {
    const stored = this.readStored();
    if (stored) {
      this.rooms = stored;
      this.syncNextId();
    }
  }

  private readStored(): GameRoom[] | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? this.parse(raw) : null;
    } catch {
      return null;
    }
  }

  private parse(raw: string): GameRoom[] | null {
    try {
      const parsed = JSON.parse(raw) as GameRoom[];
      if (!Array.isArray(parsed) || parsed.some(room => !this.isRoom(room))) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  private isRoom(room: GameRoom): boolean {
    return !!room
      && typeof room.id === 'string'
      && typeof room.code === 'string'
      && typeof room.hostId === 'string'
      && Array.isArray(room.players)
      && room.players.every(player => !!player && typeof player.id === 'string' && typeof player.name === 'string');
  }

  private persist(notify: boolean): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.rooms));
    } catch {
      // Storage can be unavailable in private browsing.
    }
    if (notify) {
      this.changed.next();
    }
  }

  private syncNextId(): void {
    const nums = this.rooms
      .map(room => Number(room.id.replace('room-', '')))
      .filter(num => !Number.isNaN(num));
    this.nextId = Math.max(4, ...nums, 0) + 1;
  }

  private copy(room: GameRoom): GameRoom {
    return {
      ...room,
      players: room.players.map(player => ({ ...player })),
      puzzle: room.puzzle ? room.puzzle.map(row => [...row]) : null
    };
  }
}
