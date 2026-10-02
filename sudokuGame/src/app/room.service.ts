import { Injectable } from '@angular/core';

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface GameRoom {
  id: string;
  code: string;
  name: string;
  isPublic: boolean;
  requireBoth: boolean;
  difficulty: Difficulty;
  players: string[];
  maxPlayers: number;
}

@Injectable({
  providedIn: 'root'
})
export class RoomService {
  private rooms: GameRoom[] = [
    { id: 'room-1', code: '100001', name: 'Morning Grid', isPublic: true, requireBoth: false, difficulty: 'easy', players: ['Ava', 'Noah'], maxPlayers: 5 },
    { id: 'room-2', code: '100002', name: 'Night Shift', isPublic: true, requireBoth: false, difficulty: 'hard', players: ['Mia', 'Leo', 'Kai', 'Sam'], maxPlayers: 5 },
    { id: 'room-3', code: '100003', name: 'Quiet Corner', isPublic: false, requireBoth: false, difficulty: 'medium', players: ['Riley'], maxPlayers: 5 }
  ];
  private nextId = 4;

  listPublic(): GameRoom[] {
    return this.rooms.filter(room => room.isPublic).map(room => this.copy(room));
  }

  nameTaken(name: string): boolean {
    const key = name.trim().toLowerCase();
    return this.rooms.some(room => room.name.toLowerCase() === key);
  }

  create(name: string, isPublic: boolean, difficulty: Difficulty, hostName: string, requireBoth: boolean): GameRoom {
    const room: GameRoom = {
      id: 'room-' + this.nextId++,
      code: this.makeCode(),
      name: name.trim(),
      isPublic,
      requireBoth,
      difficulty,
      players: [hostName],
      maxPlayers: 5
    };
    this.rooms.push(room);
    return this.copy(room);
  }

  join(id: string, playerName: string): string {
    const room = this.rooms.find(item => item.id === id);
    if (!room) {
      return 'That room is no longer open.';
    }
    if (room.players.includes(playerName)) {
      return '';
    }
    if (room.players.length >= room.maxPlayers) {
      return 'This room is full.';
    }
    room.players.push(playerName);
    return '';
  }

  joinByCode(code: string, playerName: string): { room: GameRoom | null; error: string } {
    const key = code.trim();
    const room = this.rooms.find(item => item.code === key);
    if (!room) {
      return { room: null, error: 'No room uses that ID.' };
    }
    if (room.requireBoth) {
      return { room: null, error: 'This room requires both the room ID and the room name.' };
    }
    const error = this.join(room.id, playerName);
    return { room: error ? null : this.copy(room), error };
  }

  joinPrivate(code: string, name: string, playerName: string): { room: GameRoom | null; error: string } {
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
    const error = this.join(room.id, playerName);
    return { room: error ? null : this.copy(room), error };
  }

  joinByName(name: string, playerName: string): { room: GameRoom | null; error: string } {
    const key = name.trim().toLowerCase();
    const room = this.rooms.find(item => item.name.toLowerCase() === key);
    if (!room) {
      return { room: null, error: 'No room uses that name.' };
    }
    if (room.isPublic) {
      return { room: null, error: 'That room is public. Join it from the list.' };
    }
    const error = this.join(room.id, playerName);
    return { room: error ? null : this.copy(room), error };
  }

  getRoom(id: string): GameRoom | null {
    const room = this.rooms.find(item => item.id === id);
    return room ? this.copy(room) : null;
  }

  leave(id: string, playerName: string): void {
    const room = this.rooms.find(item => item.id === id);
    if (!room) {
      return;
    }
    const index = room.players.indexOf(playerName);
    if (index >= 0) {
      room.players.splice(index, 1);
    }
    if (room.players.length === 0) {
      this.rooms = this.rooms.filter(item => item.id !== id);
    }
  }

  private makeCode(): string {
    let code = '';
    do {
      code = String(Math.floor(100000 + Math.random() * 900000));
    } while (this.rooms.some(room => room.code === code));
    return code;
  }

  private copy(room: GameRoom): GameRoom {
    return { ...room, players: [...room.players] };
  }
}
