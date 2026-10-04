import json
import os
import random
import re
import threading
import uuid
from pathlib import Path

from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS
from supabase import Client, create_client

load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

app = Flask(__name__)
CORS(app)

supabase: Client = create_client(
    os.environ.get('SUPABASE_URL'),
    os.environ.get('SUPABASE_KEY')
)

MAX_PLAYERS = 5
NAME_RE = re.compile(r'^[A-Za-z0-9 ]+$')
DIFFICULTIES = {'easy', 'medium', 'hard'}
DATA_FILE = Path(__file__).with_name('rooms.json')
MISSING_TABLE = (
    'Supabase has no public.rooms table yet. '
    'Run sudokuGameServer/schema.sql in the Supabase SQL editor, then restart this server.'
)


def row_to_room(row):
    return {
        'id': row['id'],
        'code': row['code'],
        'name': row['name'],
        'isPublic': row['is_public'],
        'requireBoth': row['require_both'],
        'difficulty': row['difficulty'],
        'hostId': row['host_id'],
        'players': row['players'] or [],
        'maxPlayers': row['max_players'],
        'round': row['round'],
        'puzzle': row['puzzle'],
    }


def room_to_row(room):
    return {
        'id': room['id'],
        'code': room['code'],
        'name': room['name'],
        'is_public': room['isPublic'],
        'require_both': room['requireBoth'],
        'difficulty': room['difficulty'],
        'host_id': room['hostId'],
        'players': room['players'],
        'max_players': room['maxPlayers'],
        'round': room['round'],
        'puzzle': room['puzzle'],
    }


def copy_room(room):
    return json.loads(json.dumps(room))


class SupabaseStore:
    def all(self):
        response = supabase.table('rooms').select('*').execute()
        return [row_to_room(row) for row in (response.data or [])]

    def insert(self, room):
        supabase.table('rooms').insert(room_to_row(room)).execute()

    def update(self, room):
        supabase.table('rooms').update(room_to_row(room)).eq('id', room['id']).execute()

    def delete(self, room_id):
        supabase.table('rooms').delete().eq('id', room_id).execute()


class FileStore:
    def __init__(self):
        self._lock = threading.Lock()
        self._rooms = []
        if DATA_FILE.exists():
            self._rooms = json.loads(DATA_FILE.read_text())

    def _write(self):
        DATA_FILE.write_text(json.dumps(self._rooms))

    def all(self):
        with self._lock:
            return [copy_room(room) for room in self._rooms]

    def insert(self, room):
        with self._lock:
            self._rooms.append(copy_room(room))
            self._write()

    def update(self, room):
        with self._lock:
            for index, item in enumerate(self._rooms):
                if item['id'] == room['id']:
                    self._rooms[index] = copy_room(room)
                    break
            self._write()

    def delete(self, room_id):
        with self._lock:
            self._rooms = [room for room in self._rooms if room['id'] != room_id]
            self._write()


def build_store():
    try:
        supabase.table('rooms').select('id').limit(1).execute()
    except Exception as exc:
        text = str(exc)
        if 'PGRST205' in text or 'schema cache' in text:
            print(MISSING_TABLE)
            print('Until then, rooms are saved in', DATA_FILE)
            return FileStore()
        raise
    print('Using Supabase for rooms.')
    return SupabaseStore()


store = build_store()


def fail(message, status=400):
    return jsonify({'room': None, 'error': message}), status


def ok_room(room):
    return jsonify({'room': room, 'error': ''})


def db_error(exc):
    text = str(exc)
    if 'PGRST205' in text or 'schema cache' in text:
        return jsonify({'room': None, 'error': MISSING_TABLE}), 503
    if 'rooms_name_lower' in text or 'duplicate key' in text:
        return fail('A room with this name already exists.')
    return jsonify({'room': None, 'error': 'The game server could not reach the database.'}), 503


def player_from(body):
    raw = (body or {}).get('player') or {}
    player_id = str(raw.get('id') or '').strip()
    name = str(raw.get('name') or '').strip()
    if not player_id or not name or len(player_id) > 40 or len(name) > 80:
        return None
    return {'id': player_id, 'name': name, 'isHost': False}


def add_player(room, player):
    if any(item['id'] == player['id'] for item in room['players']):
        return ''
    if len(room['players']) >= room['maxPlayers']:
        return 'This room is full.'
    room['players'].append({'id': player['id'], 'name': player['name'], 'isHost': False})
    store.update(room)
    return ''


def make_code(existing):
    for _ in range(20):
        code = str(random.randint(100000, 999999))
        if code not in existing:
            return code
    return str(random.randint(100000, 999999))


def clean_name(name):
    cleaned = (name or '').strip()
    if not cleaned:
        return None, 'Enter a room name.'
    if len(cleaned) > 25:
        return None, 'Room names cannot be more than 25 characters.'
    if not NAME_RE.match(cleaned):
        return None, 'Room names cannot include special characters.'
    return cleaned, ''


def valid_puzzle(puzzle):
    if not isinstance(puzzle, list) or len(puzzle) != 9:
        return False
    for row in puzzle:
        if not isinstance(row, list) or len(row) != 9:
            return False
        for value in row:
            if isinstance(value, bool) or not isinstance(value, int) or value < 0 or value > 9:
                return False
    return True


def find_id(room_id):
    return next((room for room in store.all() if room['id'] == room_id), None)


def find_code(code):
    return next((room for room in store.all() if room['code'] == code), None)


@app.route('/health')
def health():
    return jsonify({'ok': True})


@app.route('/rooms/public')
def list_public():
    try:
        rooms = [room for room in store.all() if room['isPublic']]
    except Exception as exc:
        return db_error(exc)
    return jsonify({'rooms': rooms})


@app.route('/rooms/names')
def list_names():
    try:
        names = [room['name'] for room in store.all()]
    except Exception as exc:
        return db_error(exc)
    return jsonify({'names': names})


@app.route('/rooms/<room_id>')
def get_room(room_id):
    try:
        room = find_id(room_id)
    except Exception as exc:
        return db_error(exc)
    if not room:
        return fail('That room is no longer open.', 404)
    return ok_room(room)


@app.route('/rooms', methods=['POST'])
def create_room():
    body = request.get_json(silent=True) or {}
    name, name_error = clean_name(body.get('name'))
    if name_error:
        return fail(name_error)
    difficulty = body.get('difficulty')
    if difficulty not in DIFFICULTIES:
        return fail('Choose a difficulty.')
    player = player_from(body)
    if not player:
        return fail('A player is required.')
    try:
        rooms = store.all()
    except Exception as exc:
        return db_error(exc)
    if any(room['name'].lower() == name.lower() for room in rooms):
        return fail('A room with this name already exists.')
    room = {
        'id': 'room-' + uuid.uuid4().hex[:12],
        'code': make_code({item['code'] for item in rooms}),
        'name': name,
        'isPublic': bool(body.get('isPublic', True)),
        'requireBoth': bool(body.get('requireBoth', False)),
        'difficulty': difficulty,
        'hostId': player['id'],
        'players': [{'id': player['id'], 'name': player['name'], 'isHost': True}],
        'maxPlayers': MAX_PLAYERS,
        'round': 0,
        'puzzle': None,
    }
    try:
        store.insert(room)
    except Exception as exc:
        return db_error(exc)
    return ok_room(room)


@app.route('/rooms/join', methods=['POST'])
def join_room():
    body = request.get_json(silent=True) or {}
    player = player_from(body)
    if not player:
        return fail('A player is required.')
    try:
        room = find_id(str(body.get('id') or ''))
    except Exception as exc:
        return db_error(exc)
    if not room:
        return fail('That room is no longer open.', 404)
    try:
        error = add_player(room, player)
    except Exception as exc:
        return db_error(exc)
    if error:
        return fail(error)
    return ok_room(room)


@app.route('/rooms/join-by-code', methods=['POST'])
def join_by_code():
    body = request.get_json(silent=True) or {}
    player = player_from(body)
    if not player:
        return fail('A player is required.')
    try:
        room = find_code(str(body.get('code') or '').strip())
    except Exception as exc:
        return db_error(exc)
    if not room:
        return fail('No room uses that ID.')
    if room['requireBoth']:
        return fail('This room requires both the room ID and the room name.')
    try:
        error = add_player(room, player)
    except Exception as exc:
        return db_error(exc)
    if error:
        return fail(error)
    return ok_room(room)


@app.route('/rooms/join-private', methods=['POST'])
def join_private():
    body = request.get_json(silent=True) or {}
    player = player_from(body)
    if not player:
        return fail('A player is required.')
    code = str(body.get('code') or '').strip()
    name = str(body.get('name') or '').strip().lower()
    if not code and not name:
        return fail('Enter a room ID or a room name.')
    try:
        rooms = store.all()
    except Exception as exc:
        return db_error(exc)
    by_code = next((room for room in rooms if code and room['code'] == code), None)
    by_name = next((room for room in rooms if name and room['name'].lower() == name), None)
    if code and not by_code:
        return fail('No room uses that ID.')
    if name and not by_name:
        return fail('No room uses that name.')
    if by_code and by_name and by_code['id'] != by_name['id']:
        return fail('That room ID and room name do not match.')
    room = by_code or by_name
    if room['requireBoth'] and (not by_code or not by_name):
        return fail('This room requires both the room ID and the room name.')
    if not room['requireBoth'] and by_name and not by_code and room['isPublic']:
        return fail('That room is public. Join it from the list.')
    try:
        error = add_player(room, player)
    except Exception as exc:
        return db_error(exc)
    if error:
        return fail(error)
    return ok_room(room)


@app.route('/rooms/<room_id>/puzzle', methods=['POST'])
def publish_puzzle(room_id):
    body = request.get_json(silent=True) or {}
    host_id = str(body.get('hostId') or '').strip()
    puzzle = body.get('puzzle')
    if not valid_puzzle(puzzle):
        return fail('The puzzle is not a 9 by 9 grid.')
    try:
        room = find_id(room_id)
    except Exception as exc:
        return db_error(exc)
    if not room:
        return fail('That room is no longer open.', 404)
    if room['hostId'] != host_id:
        return fail('Only the host can start the next maze.')
    room['puzzle'] = puzzle
    room['round'] += 1
    try:
        store.update(room)
    except Exception as exc:
        return db_error(exc)
    return ok_room(room)


@app.route('/rooms/<room_id>/leave', methods=['POST'])
def leave_room(room_id):
    body = request.get_json(silent=True) or {}
    player_id = str(body.get('playerId') or '').strip()
    if not player_id:
        return fail('A player is required.')
    try:
        room = find_id(room_id)
        if not room:
            return jsonify({'ok': True})
        leaving = next((item for item in room['players'] if item['id'] == player_id), None)
        room['players'] = [item for item in room['players'] if item['id'] != player_id]
        if not room['players']:
            store.delete(room_id)
        else:
            if leaving and leaving.get('isHost'):
                room['players'][0]['isHost'] = True
                room['hostId'] = room['players'][0]['id']
            store.update(room)
    except Exception as exc:
        return db_error(exc)
    return jsonify({'ok': True})


if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5050, debug=True)
