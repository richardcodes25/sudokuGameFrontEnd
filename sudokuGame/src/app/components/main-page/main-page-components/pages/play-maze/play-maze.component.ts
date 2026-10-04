import { Component, ElementRef, HostListener, OnDestroy, OnInit, QueryList, ViewChildren } from '@angular/core';
import { Subscription } from 'rxjs';
import Swal from 'sweetalert2';
import { MazeSquare } from './MazeSquare';
import { ShareService } from 'src/app/share.service';
import { Difficulty, GameRoom, RoomPlayer, RoomService } from 'src/app/room.service';

class Coordinate {
  row: number;
  column: number;

  constructor(row: number, column: number) {
    this.row = row;
    this.column = column;
  }
}

@Component({
  selector: 'app-play-maze',
  templateUrl: './play-maze.component.html',
  styleUrls: ['./play-maze.component.scss']
})

export class PlayMazeComponent implements OnInit, OnDestroy {
  @ViewChildren('cellInput') cellInputs!: QueryList<ElementRef<HTMLInputElement>>;

  mazeList : MazeSquare[][];
  selectedRow = -1;
  selectedCol = -1;

  soluong:number = 9;
  x: String[] = [];
  isSolve: boolean = false;

  gameStarted: boolean = false;
  mazeReady: boolean = false;

  time: string = "00:00:00";
  stopTime: boolean = true;
  screen: 'menu' | 'lobby' | 'room' | 'play' = 'menu';
  playMode: 'friend' | 'computer' = 'friend';
  pendingMode: 'friend' | 'computer' = 'computer';
  dialog: 'none' | 'account' | 'signin' | 'setup' | 'create-room' | 'room-ready' = 'none';
  difficulty: Difficulty = 'medium';
  readonly maxLives = 3;
  lives = 3;
  lifeSlots = [0, 1, 2];
  outOfLives = false;
  publicRooms: GameRoom[] = [];
  currentRoom: GameRoom | null = null;
  roomName = '';
  roomIsPublic = true;
  roomRequireBoth = false;
  roomDifficulty: Difficulty = 'medium';
  privateJoinCode = '';
  privateRoomName = '';
  privateJoinError = '';
  roomCode = '';
  roomCodeError = '';
  idCopied = false;
  timerMode: 'stopwatch' | 'countdown' = 'stopwatch';
  countdownMinutes = 15;
  countdownChoices = [10, 15, 30, 45];
  countdownTotal = 15 * 60;
  remaining = 15 * 60;
  timeUp = false;
  signedIn = false;
  signInEmail = '';
  signInPassword = '';
  guestId = '';
  roomNotice = '';
  private loadedRound = -1;
  private roomWatch?: Subscription;
  private readonly guestKey = 'sudoku-guest-id';
  second: string = "0";
  minute: string = "0";
  hour: string = "0";
  sec: number = 0;
  min: number = 0;
  hr: number = 0;

  checkButtonDisable: boolean= false;

  constructor(private shareService: ShareService, private roomService: RoomService) {
    this.mazeList = [];
    for (let i=0;i<9;i++) {
      this.mazeList[i] = [];
      for (let j=0;j<9;j++) {
        this.mazeList[i][j] = new MazeSquare("", true);
      }
    }

    console.log(this.mazeList);
    this.shareService.maze = [];
  }

  ngOnInit(): void {
    this.guestId = sessionStorage.getItem(this.guestKey) ?? '';
    this.roomWatch = this.roomService.changes$.subscribe(() => this.onRoomsChanged());
  }

  ngOnDestroy(): void {
    this.roomWatch?.unsubscribe();
  }

  trackByIndex(index: number): number {
    return index;
  }

  trackByPlayer(_index: number, player: RoomPlayer): string {
    return player.id;
  }

  displayValue(cell: MazeSquare): string {
    const value = cell?.value;
    if (value === '' || value == null || value === 0 || value === '0') {
      return '';
    }
    return String(value);
  }

  isRelated(row: number, col: number): boolean {
    if (this.selectedRow < 0 || this.selectedCol < 0) {
      return false;
    }
    if (row === this.selectedRow && col === this.selectedCol) {
      return false;
    }
    if (row === this.selectedRow || col === this.selectedCol) {
      return true;
    }
    return Math.floor(row / 3) === Math.floor(this.selectedRow / 3)
      && Math.floor(col / 3) === Math.floor(this.selectedCol / 3);
  }

  onCellFocus(event: FocusEvent, row: number, col: number): void {
    this.selectedRow = row;
    this.selectedCol = col;
    (event.target as HTMLInputElement).select();
  }

  onCellBlur(event: FocusEvent): void {
    const next = event.relatedTarget as HTMLElement | null;
    if (!next || !next.classList.contains('cell')) {
      this.selectedRow = -1;
      this.selectedCol = -1;
    }
  }

  onCellKeydown(event: KeyboardEvent, row: number, col: number): void {
    const key = event.key;
    if (this.mazeList[row][col].isDisable) {
      if (key.startsWith('Arrow')) {
        event.preventDefault();
        this.moveFocus(row, col, key);
      } else if (key.length === 1 && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
      }
      return;
    }

    if (key === 'Backspace' || key === 'Delete') {
      event.preventDefault();
      this.commitCell(event.target as HTMLInputElement, row, col, '');
      return;
    }
    if (key === 'ArrowUp' || key === 'ArrowDown' || key === 'ArrowLeft' || key === 'ArrowRight') {
      event.preventDefault();
      this.moveFocus(row, col, key);
      return;
    }
    if (/^[1-9]$/.test(key)) {
      event.preventDefault();
      this.commitCell(event.target as HTMLInputElement, row, col, key);
      return;
    }
    if (key.length === 1 && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
    }
  }

  onCellBeforeInput(event: Event, row: number, col: number): void {
    const inputEvent = event as InputEvent;
    if (this.mazeList[row][col].isDisable) {
      inputEvent.preventDefault();
      return;
    }
    const input = inputEvent.target as HTMLInputElement;
    if (inputEvent.inputType?.startsWith('delete')) {
      inputEvent.preventDefault();
      this.commitCell(input, row, col, '');
      return;
    }
    if (inputEvent.inputType === 'insertText' || inputEvent.inputType === 'insertCompositionText') {
      inputEvent.preventDefault();
      const digit = inputEvent.data ?? '';
      if (/^[1-9]$/.test(digit)) {
        this.commitCell(input, row, col, digit);
      }
    }
  }

  onCellPaste(event: ClipboardEvent, row: number, col: number): void {
    event.preventDefault();
    if (this.mazeList[row][col].isDisable) {
      return;
    }
    const digit = (event.clipboardData?.getData('text') ?? '').trim().charAt(0);
    if (/^[1-9]$/.test(digit)) {
      this.commitCell(event.target as HTMLInputElement, row, col, digit);
    }
  }

  private commitCell(input: HTMLInputElement, row: number, col: number, value: string): void {
    if (this.outOfLives && value !== '') {
      if (input) {
        input.value = this.displayValue(this.mazeList[row][col]);
      }
      return;
    }
    const previous = this.displayValue(this.mazeList[row][col]);
    if (value === previous) {
      if (input) {
        input.value = previous;
      }
      return;
    }
    this.mazeList[row][col].value = value;
    if (input) {
      input.value = value;
    }
    if (!value || !this.gameStarted) {
      this.mazeList[row][col].isWrong = false;
      return;
    }
    const invalid = this.isInvalidEntry(row, col, value);
    this.mazeList[row][col].isWrong = invalid;
    if (invalid) {
      this.loseLife();
    }
  }

  private isInvalidEntry(row: number, col: number, value: string): boolean {
    const digit = Number(value);
    if (!digit) {
      return false;
    }
    const answer = this.solution.length === 9 ? Number(this.solution[row][col]) : 0;
    if (answer) {
      return digit !== answer;
    }
    for (let c = 0; c < 9; c++) {
      if (c !== col && Number(this.mazeList[row][c].value) === digit) {
        return true;
      }
    }
    for (let r = 0; r < 9; r++) {
      if (r !== row && Number(this.mazeList[r][col].value) === digit) {
        return true;
      }
    }
    const startRow = row - (row % 3);
    const startCol = col - (col % 3);
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        if (startRow + r === row && startCol + c === col) {
          continue;
        }
        if (Number(this.mazeList[startRow + r][startCol + c].value) === digit) {
          return true;
        }
      }
    }
    return false;
  }

  private loseLife(): void {
    if (this.outOfLives || this.lives <= 0) {
      return;
    }
    this.lives -= 1;
    if (this.lives > 0) {
      return;
    }
    this.lives = 0;
    this.outOfLives = true;
    this.stopTime = true;
    this.checkButtonDisable = true;
    for (let i = 0; i < 9; i++) {
      for (let j = 0; j < 9; j++) {
        this.mazeList[i][j].isDisable = true;
      }
    }
    Swal.fire({
      icon: 'warning',
      title: 'No lives left',
      text: 'That number was not correct, and you have used all 3 lives.',
      confirmButtonColor: '#148F10',
      allowOutsideClick: true,
      allowEscapeKey: true
    });
  }

  private moveFocus(row: number, col: number, key: string): void {
    let nextRow = row;
    let nextCol = col;
    if (key === 'ArrowLeft') nextCol = Math.max(0, col - 1);
    if (key === 'ArrowRight') nextCol = Math.min(8, col + 1);
    if (key === 'ArrowUp') nextRow = Math.max(0, row - 1);
    if (key === 'ArrowDown') nextRow = Math.min(8, row + 1);
    this.cellInputs?.get(nextRow * 9 + nextCol)?.nativeElement.focus();
  }

  chooseFriend(): void {
    this.ensureGuestId();
    this.pendingMode = 'friend';
    this.playMode = 'friend';
    this.dialog = 'account';
  }

  chooseComputer(): void {
    this.pendingMode = 'computer';
    this.playMode = 'computer';
    this.dialog = 'account';
  }

  continueAsGuest(): void {
    this.signedIn = false;
    this.afterAccount();
  }

  openSignIn(): void {
    this.dialog = 'signin';
  }

  submitSignIn(): void {
    if (!this.signInEmail.trim() || !this.signInPassword) {
      return;
    }
    this.signedIn = true;
    this.signInPassword = '';
    this.afterAccount();
  }

  private afterAccount(): void {
    if (this.pendingMode === 'friend') {
      this.playMode = 'friend';
      this.dialog = 'none';
      this.screen = 'lobby';
      this.privateJoinError = '';
      this.refreshRooms();
      return;
    }
    this.dialog = 'setup';
  }

  playerName(): string {
    if (this.signedIn && this.signInEmail.trim()) {
      return this.signInEmail.trim();
    }
    return this.guestId || 'guest';
  }

  isHost(): boolean {
    return !!this.currentRoom?.players.some(player => player.isHost && player.id === this.guestId);
  }

  waitingSummary(): string {
    const waiting = this.currentRoom?.players.filter(player => !player.isHost).length ?? 0;
    if (waiting === 0) {
      return 'No one else has joined yet.';
    }
    if (waiting === 1) {
      return '1 player joined and is waiting.';
    }
    return waiting + ' players joined and are waiting.';
  }

  avatarColor(id: string): string {
    const colors = ['#6aaedc', '#e090b4', '#b496e0', '#7dcaa8', '#e0b06a', '#8a90d8'];
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = (hash + id.charCodeAt(i)) % colors.length;
    }
    return colors[hash];
  }

  private ensureGuestId(): string {
    if (!this.guestId) {
      this.guestId = 'guest-' + Math.floor(1000000 + Math.random() * 9000000);
      sessionStorage.setItem(this.guestKey, this.guestId);
    }
    return this.guestId;
  }

  private currentPlayer(): RoomPlayer {
    return { id: this.ensureGuestId(), name: this.playerName(), isHost: false };
  }

  difficultyLabel(level: Difficulty): string {
    if (level === 'easy') return 'Easy';
    if (level === 'hard') return 'Hard';
    return 'Medium';
  }

  roomNameError(): string {
    const name = this.roomName.trim();
    if (!name) {
      return 'Enter a room name.';
    }
    if (name.length > 25) {
      return 'Room names cannot be more than 25 characters.';
    }
    if (!/^[A-Za-z0-9 ]+$/.test(name)) {
      return 'Room names cannot include special characters.';
    }
    if (this.roomService.nameTaken(name)) {
      return 'A room with this name already exists.';
    }
    return '';
  }

  openCreateRoom(): void {
    this.roomName = '';
    this.roomIsPublic = true;
    this.roomRequireBoth = false;
    this.roomDifficulty = 'medium';
    this.dialog = 'create-room';
  }

  createRoom(): void {
    if (this.roomNameError()) {
      return;
    }
    const room = this.roomService.create(this.roomName, this.roomIsPublic, this.roomDifficulty, this.currentPlayer(), this.roomRequireBoth);
    this.currentRoom = room;
    this.loadedRound = room.round;
    this.idCopied = false;
    this.roomNotice = '';
    this.dialog = 'room-ready';
  }

  startHostedGame(): void {
    if (!this.currentRoom || !this.isHost()) {
      return;
    }
    this.difficulty = this.currentRoom.difficulty;
    this.generatePuzzle();
    this.roomService.publishPuzzle(this.currentRoom.id, this.cloneDeep(this.chuot_bach_array), this.guestId);
  }

  nextMaze(): void {
    if (!this.currentRoom || !this.isHost()) {
      return;
    }
    this.difficulty = this.currentRoom.difficulty;
    this.generatePuzzle();
    this.roomService.publishPuzzle(this.currentRoom.id, this.cloneDeep(this.chuot_bach_array), this.guestId);
  }

  cancelCreatedRoom(): void {
    this.dialog = 'none';
    this.leaveRoom();
  }

  copyRoomId(): void {
    const code = this.currentRoom?.code;
    if (!code || !navigator.clipboard?.writeText) {
      return;
    }
    navigator.clipboard.writeText(code).then(() => {
      this.idCopied = true;
    });
  }

  joinByRoomId(): void {
    const result = this.roomService.joinByCode(this.roomCode, this.currentPlayer());
    this.roomCodeError = result.error;
    if (result.room) {
      this.roomCode = '';
      this.enterRoom(result.room);
    }
  }

  joinRoom(room: GameRoom): void {
    const error = this.roomService.join(room.id, this.currentPlayer());
    if (error) {
      this.privateJoinError = error;
      this.refreshRooms();
      return;
    }
    const joined = this.roomService.getRoom(room.id);
    if (joined) {
      this.enterRoom(joined);
    }
  }

  joinPrivateRoom(): void {
    const result = this.roomService.joinPrivate(this.privateJoinCode, this.privateRoomName, this.currentPlayer());
    this.privateJoinError = result.error;
    if (result.room) {
      this.privateJoinCode = '';
      this.privateRoomName = '';
      this.enterRoom(result.room);
    }
  }

  leaveRoom(): void {
    this.stopTime = true;
    if (this.currentRoom) {
      this.roomService.leave(this.currentRoom.id, this.guestId);
      this.currentRoom = null;
      this.loadedRound = -1;
      this.roomNotice = '';
    }
    this.dialog = 'none';
    this.gameStarted = false;
    this.screen = 'lobby';
    this.refreshRooms();
  }

  backToLobby(): void {
    this.screen = 'lobby';
    this.refreshRooms();
  }

  private refreshRooms(): void {
    this.publicRooms = this.roomService.listPublic();
  }

  private enterRoom(room: GameRoom): void {
    this.currentRoom = room;
    this.playMode = 'friend';
    this.difficulty = room.difficulty;
    this.timerMode = 'stopwatch';
    this.dialog = 'none';
    this.privateJoinError = '';
    this.roomNotice = '';
    this.loadedRound = room.round;
    if (room.puzzle && room.round > 0) {
      this.dialog = 'none';
      this.screen = 'play';
      this.applyPuzzle(room.puzzle);
      return;
    }
    this.screen = 'lobby';
    this.dialog = 'room-ready';
  }

  private onRoomsChanged(): void {
    this.refreshRooms();
    if (!this.currentRoom) {
      return;
    }
    const latest = this.roomService.getRoom(this.currentRoom.id);
    if (!latest || !latest.players.some(player => player.id === this.guestId)) {
      this.stopTime = true;
      this.currentRoom = null;
      this.loadedRound = -1;
      this.dialog = 'none';
      this.screen = 'lobby';
      this.refreshRooms();
      return;
    }
    const wasPlaying = this.screen === 'play';
    const roundChanged = latest.round !== this.loadedRound && !!latest.puzzle;
    this.currentRoom = latest;
    if (!roundChanged || !latest.puzzle) {
      return;
    }
    this.loadedRound = latest.round;
    this.difficulty = latest.difficulty;
    this.roomNotice = wasPlaying && latest.round > 1
      ? 'The host moved everyone to the next maze.'
      : '';
    this.dialog = 'none';
    this.screen = 'play';
    this.applyPuzzle(latest.puzzle);
  }

  private applyPuzzle(grid: number[][]): void {
    this.mazeReady = true;
    this.lives = this.maxLives;
    this.outOfLives = false;
    this.isSolve = false;
    this.chuot_bach_array = grid.map(row => [...row]);
    this.resetClock();
    for (let i = 0; i < 9; i++) {
      for (let j = 0; j < 9; j++) {
        this.mazeList[i][j].isWrong = false;
        if (this.chuot_bach_array[i][j] == 0) {
          this.mazeList[i][j].value = '';
          this.mazeList[i][j].isDisable = false;
          this.mazeList[i][j].isClue = false;
        } else {
          this.mazeList[i][j].value = this.chuot_bach_array[i][j];
          this.mazeList[i][j].isDisable = true;
          this.mazeList[i][j].isClue = true;
        }
      }
    }
    this.gameStarted = true;
    this.checkButtonDisable = false;
    this.stopTime = false;
    this.timerCycle();
  }

  selectDifficulty(level: 'easy' | 'medium' | 'hard'): void {
    this.difficulty = level;
  }

  selectTimerMode(mode: 'stopwatch' | 'countdown'): void {
    this.timerMode = mode;
  }

  selectCountdown(minutes: number): void {
    this.countdownMinutes = minutes;
    this.countdownTotal = minutes * 60;
  }

  startComputerGame(): void {
    this.playMode = 'computer';
    this.countdownTotal = this.countdownMinutes * 60;
    this.dialog = 'none';
    this.screen = 'play';
    this.resetClock();
    this.fillMatrix();
  }

  backToMenu(): void {
    this.stopTime = true;
    this.dialog = 'none';
    this.screen = 'menu';
    this.gameStarted = false;
  }

  closeDialog(): void {
    if (this.dialog === 'room-ready') {
      return;
    }
    this.dialog = 'none';
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.dialog !== 'none' && this.dialog !== 'room-ready') {
      this.closeDialog();
    }
  }

  //-------------------------------------------------------------------
  //Timer
  timerCycle():void {
    if (this.stopTime) {
      return;
    }
    if (this.timerMode === 'countdown') {
      setTimeout(() => {
        if (this.stopTime) {
          return;
        }
        this.remaining = Math.max(0, this.remaining - 1);
        this.writeClock(this.remaining);
        if (this.remaining === 0) {
          this.finishCountdown();
          return;
        }
        this.timerCycle();
      }, 1000);
      return;
    }
    if (this.stopTime == false) {
      this.sec = parseInt(this.second);
      this.min = parseInt(this.minute);
      this.hr = parseInt(this.hour);

      this.sec = this.sec +1;
      if (this.sec == 60) {
        this.min = this.min +1;
        this.sec = 0
      }
      if (this.min == 60) {
        this.hr = this.hr +1;
        this.min = 0;
        this.sec = 0;
      }
      if (this.sec < 10 || this.sec == 0) {
        this.second = "0" + this.sec;
      } else {
        this.second = this.sec.toString();
      }
      if (this.min < 10 || this.min == 0) {
        this.minute = "0" + this.min;
      } else {
        this.minute = this.min.toString();
      }
      if (this.hr < 10 || this.hr == 0) {
        this.hour = "0" + this.hr;
      } else {
        this.hour = this.hr.toString();
      }

      this.time = this.hour + ":" + this.minute + ":" + this.second;
      setTimeout(() => {
        this.timerCycle();
      }, 1000);
    }
  }

  private writeClock(totalSeconds: number): void {
    const safe = Math.max(0, totalSeconds);
    const hr = Math.floor(safe / 3600);
    const min = Math.floor((safe % 3600) / 60);
    const sec = safe % 60;
    this.hr = hr;
    this.min = min;
    this.sec = sec;
    this.hour = hr < 10 ? '0' + hr : String(hr);
    this.minute = min < 10 ? '0' + min : String(min);
    this.second = sec < 10 ? '0' + sec : String(sec);
    this.time = this.hour + ':' + this.minute + ':' + this.second;
  }

  private resetClock(): void {
    this.stopTime = true;
    this.timeUp = false;
    if (this.timerMode === 'countdown') {
      this.remaining = this.countdownTotal;
      this.writeClock(this.remaining);
      return;
    }
    this.sec = 0;
    this.min = 0;
    this.hr = 0;
    this.second = '0';
    this.minute = '0';
    this.hour = '0';
    this.time = '00:00:00';
  }

  private finishCountdown(): void {
    this.stopTime = true;
    this.timeUp = true;
    this.checkButtonDisable = true;
    this.writeClock(0);
    for (let i = 0; i < 9; i++) {
      for (let j = 0; j < 9; j++) {
        this.mazeList[i][j].isDisable = true;
      }
    }
    Swal.fire({
      icon: 'warning',
      title: 'Time is up',
      text: 'The countdown reached zero.',
      confirmButtonColor: '#148F10',
      allowOutsideClick: true,
      allowEscapeKey: true
    });
  }

  private clueTarget(): number {
    if (this.difficulty === 'easy') {
      return 46;
    }
    if (this.difficulty === 'hard') {
      return 28;
    }
    return 36;
  }

  //--------------------------------------------------------------------
  //Start-Pause-Continue
  startGame() {
    this.gameStarted = true;
    this.checkButtonDisable = false;
    if (this.stopTime == true) {
      this.stopTime = false;
      this.timerCycle();
    } else {
      this.stopTime = true;
    }
  }

  pauseGame() {
    this.gameStarted = true;
    this.checkButtonDisable = true;
    if (this.stopTime == true) {
      this.stopTime = false;
      this.timerCycle();
    } else {
      this.stopTime = true;
    }

    for (let i = 0; i < 9; i++) {
      for (let j = 0; j< 9;j++) {
        this.mazeList[i][j].isDisable = true;
      }
    }
  }

  continueGame() {
    if (this.timeUp || this.outOfLives) {
      return;
    }
    this.gameStarted = true;
    this.checkButtonDisable = false;
    if (this.stopTime == true) {
      this.stopTime = false;
      this.timerCycle();
    } else {
      this.stopTime = true;
    }

    for (let i = 0; i < 9; i++) {
      for (let j = 0; j < 9; j++) {
        this.mazeList[i][j].isDisable = this.mazeList[i][j].isClue;
      }
    }
  }

  //-------------------------------------------------------------------
  //Reset the maze and set button to start
  reset() {
    // this.canBesolve = true;
    this.isSolve = false;
    console.log(this.mazeList);

    this.gameStarted = false;
    this.resetClock();
    this.lives = this.maxLives;
    this.outOfLives = false;

    for (let i = 0; i < 9; i++) {
      for (let j = 0; j< 9;j++) {
        this.mazeList[i][j].value = "";
        this.mazeList[i][j].isDisable = true;
        this.mazeList[i][j].isClue = false;
        this.mazeList[i][j].isWrong = false;
      }
    }

    if (this.solution.length === 9) {
      for (let i = 0; i < 9; i++) {
        for (let j = 0; j< 9;j++) {
          this.solution[i][j] = 0;
        }
      }
    }
    console.clear();
  }

  //-------------------------------------------------------------------
  //To fill the maze into the matrix
  fillMatrix() {
    this.mazeReady = true;
    this.lives = this.maxLives;
    this.outOfLives = false;
    this.generatePuzzle();
    for (let i = 0; i < 9; i++) {
      for (let j = 0; j< 9;j++) {
        this.mazeList[i][j].isWrong = false;
        if (this.chuot_bach_array[i][j] == 0) {
          this.mazeList[i][j].value = "";
          this.mazeList[i][j].isDisable = false;
          this.mazeList[i][j].isClue = false;
        } else {
          this.mazeList[i][j].value = this.chuot_bach_array[i][j];
          this.mazeList[i][j].isDisable = true;
          this.mazeList[i][j].isClue = true;
        }
      }
    }

    this.gameStarted = true;
    this.checkButtonDisable = false;
    if (this.stopTime == true) {
      this.stopTime = false;
      this.timerCycle();
    }
  }

  checkSmallBox() {

  }
  //-----------------------------------------------------------------
  //Checking isValid?
  checkSolution() {
    let goodMaze: boolean = true;

    for (let i=0;i<9;i++) {
      for (let j=0;j<9;j++) {
        if (this.mazeList[i][j].value == "") {
          this.mazeList[i][j].value = 0;
        }

        for(let c1 = 0; c1 < 9; c1++) {
          if(c1 != j && this.mazeList[i][j].value == this.mazeList[i][c1].value) {
            // console.log("Pair ("+i+","+j+")="+this.mazeList[i][j]+"and " + "pair ("+i+","+c1+") = " + this.mazeList[i][c1]);
            goodMaze = false;
            break;
          }
        }

        for(let r1 = 0; r1 < 9; r1++) {
            if(r1 != i && this.mazeList[i][j].value == this.mazeList[r1][j].value) {
              // console.log("Pair ("+i+","+j+")="+this.mazeList[i][j]+"and " + "pair ("+r1+","+j+") = " + this.mazeList[r1][j]);
              goodMaze = false;
              break;
            }
        }

        let start_r = i - i%3;
        let start_c = j - j%3;
        for(let r1 = 0; r1 < 3; r1++){
            for(let c1 = 0; c1 < 3; c1++){
                if(i != (r1+start_r) && j != (c1+start_c) && this.mazeList[i][j].value  == this.mazeList[r1+start_r][c1+start_c].value) {
                  // console.log("Pair ("+i+","+j+")="+this.mazeList[i][j]+"and " + "pair ("+(r1+start_r)+","+(c1+start_c)+") = " + this.mazeList[r1+start_r][c1+start_c]);
                  goodMaze = false;
                  break;
                }
            }
        }

        if (this.mazeList[i][j].value == 0) {
          this.mazeList[i][j].value = "";
          this.mazeList[i][j].isDisable = false;
        }
      }
    }

    if (goodMaze == false) {
      this.isSolve = false;

      Swal.fire({
        icon: 'error',
        title: 'Please try again, I believe you can do it <span>&#9996;</span>',
        showConfirmButton: true,
        timer: 2506,
        allowOutsideClick: true,
        allowEscapeKey: true
      })
    } else {
      this.isSolve = true;

      if (!this.stopTime) {
        this.stopTime = true;
      }

      let alertMessage = 'Congratulation! You finish the quiz with ' + this.time + ' <span>&#128509;</span>';
      Swal.fire({
        icon: 'success',
        title: alertMessage,
        showConfirmButton: true,
        timer: 25060,
        allowOutsideClick: true,
        allowEscapeKey: true
      })
    }
  }

  //----------------------------------------------------------------
  //Add solution for testing
  solution:number[][] = [];
  addSolution() {
    for (let i = 0; i < 9; i++) {
      for (let j = 0; j< 9;j++) {
        this.mazeList[i][j].value = this.solution[i][j];
        this.mazeList[i][j].isDisable = true;
      }
    }
  }

  //------------------------------------------------------------------
  chuot_bach_array: number[][] = [];
  counter: number = 0;
  path: [number, number, number][] = [];

  mazeValid(): boolean {
    for(let i=0;i<9;i++) {
      for(let j=0;j<9;j++) {
        if (this.chuot_bach_array[i][j] == 0) {
          return false;
        }
      }
    }
    return true;
  }

  emptyMaze(): void {
    this.chuot_bach_array = [];
    for (let i=0;i<9;i++) {
      this.chuot_bach_array[i] = [];
      for (let j=0;j<9;j++) {
        this.chuot_bach_array[i][j] = 0;
      }
    }
  }

  generatePuzzle(): void {
    this.emptyMaze();
    this.printGrid('empty');
    while (!this.mazeValid()) {
      this.emptyMaze();
      this.generateSolution(this.chuot_bach_array);
    }
    this.solution = this.cloneDeep(this.chuot_bach_array);
    this.printGrid('full solution');
    this.removeNumbersFromGrid();
    this.printGrid('with removed numbers');

    this.shareService.updateMaze(this.chuot_bach_array, this.shareService.maze);
    console.log("Maze của ShareService");
    console.log(this.shareService.maze);
  }

  //Print the maze at current status
  printGrid(gridName?: string): void {
    if (gridName) {
      console.log(gridName);
    }
    this.chuot_bach_array.forEach(row => console.log(row));
  }

  //---------------------------------------------------------------------------
  //Step 1: Generate a maze
  shuffle(array: any[]): any[] {
    for (let i = array.length - 1;i>0;i--) {
        const j = Math.floor(Math.random() * (i+1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  };

  generateSolution(chuot_bach_array: number[][]): boolean {
    let numberList = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    for (let i = 0; i < 81; i++) {
      const row = Math.floor(i / 9);
      const col = i % 9;
      if (chuot_bach_array[row][col] === 0) {
        //Shuffle the maze to get a random number
        numberList = this.shuffle(numberList);
        for (const number of numberList) {
          if (this.validLocation(chuot_bach_array, row, col, number)) {
            this.path.push([number, row, col]);
            chuot_bach_array[row][col] = number;

            const emptySquare: number[] = this.findEmptySquare(chuot_bach_array);
            if (emptySquare.length == 0) {
              return true;
            } else {
              if (this.generateSolution(chuot_bach_array)) {
                return true;
              }
            }
          }
        }
        break;
      }
    }
    var result: number[] = [];
    result = this.findEmptySquare(chuot_bach_array).length != 0 ? this.findEmptySquare(chuot_bach_array) : [0,0];
    chuot_bach_array[result[0]][result[1]] = 0;
    return false;
  }

  //----------------------------------------------------------------------------------
  //Check whether the solution is valid?
  validLocation(chuot_bach_array: number[][], row: number, col: number, number: number): boolean {
    if (this.numUsedInRow(chuot_bach_array, row, number)) {
      return false;
    } else if (this.numUsedInColumn(chuot_bach_array, col, number)) {
      return false;
    } else if (this.numUsedInSubgrid(chuot_bach_array, row, col, number)) {
      return false;
    }
    return true;
  }

  //Test cell in row
  numUsedInRow(chuot_bach_array: number[][], row: number, number: number): boolean {
    return chuot_bach_array[row].includes(number);
  }

  //Test cell in column
  numUsedInColumn(chuot_bach_array: number[][], col: number, number: number): boolean {
    for (let i = 0; i < 9; i++) {
      if (chuot_bach_array[i][col] === number) {
        return true;
      }
    }
    return false;
  }

  //Test cell in 3x3 div
  numUsedInSubgrid(chuot_bach_array: number[][], row: number, col: number, number: number): boolean {
    const subRow = Math.floor(row / 3) * 3;
    const subCol = Math.floor(col / 3) * 3;
    for (let i = subRow; i < subRow + 3; i++) {
      for (let j = subCol; j < subCol + 3; j++) {
        if (chuot_bach_array[i][j] === number) {
          return true;
        }
      }
    }
    return false;
  }

  //Looking for remained cells
  findEmptySquare(chuot_bach_array: number[][]): number[] {
    let result: number[] = [];
    for (let i = 0; i < 9; i++) {
      for (let j = 0; j < 9; j++) {
        if (chuot_bach_array[i][j] === 0) {
          result.push(i);
          result.push(j)
          return result;
        }
      }
    }
    return result;
  }

// //----------------------------------------------------------------------------------
  getNonEmptySquares(chuot_bach_array: number[][]): Coordinate[] {
    let nonEmptySquares: Coordinate[] = [];
    for (let i = 0; i < 9; i++) {
      for (let j = 0; j < 9; j++) {
        if (chuot_bach_array[i][j] !== 0) {
          let x = new Coordinate(i, j);
          nonEmptySquares.push(x);
        }
      }
    }
    nonEmptySquares = this.shuffle(nonEmptySquares);
    return nonEmptySquares;
  }

  cloneDeep(chuot_bach_array: number[][]): number[][] {
    let chuotbackCopy: number[][] = [];
    for (let i=0;i<9;i++) {
      chuotbackCopy[i] = [];
      for (let j=0;j<9;j++) {
        chuotbackCopy[i][j] = this.chuot_bach_array[i][j];
      }
    }
    return chuotbackCopy;
  }

  solvePuzzle(grid: number[][]): boolean {
    for (let i = 0; i < 81; i++) {
      const row = Math.floor(i / 9);
      const col = i % 9;
      if (grid[row][col] === 0) {
        for (let number = 1; number <= 9; number++) {
          if (this.validLocation(grid, row, col, number)) {
            grid[row][col] = number;
            const emptySquare = this.findEmptySquare(grid);
            if (emptySquare.length == 0) {
              this.counter++;
              break;
            } else {
              if (this.solvePuzzle(grid)) {
                return true;
              }
            }
          }
        }
        break;
      }
    }
    var result: number[] = [];
    result = this.findEmptySquare(this.chuot_bach_array).length != 0 ? this.findEmptySquare(this.chuot_bach_array) : [0,0];
    this.chuot_bach_array[result[0]][result[1]] = 0;
    return false;
  }

  removeNumbersFromGrid(): void {
    const nonEmptySquares = this.getNonEmptySquares(this.chuot_bach_array);
    // console.log(nonEmptySquares);
    // console.log(typeof(nonEmptySquares[0]))
    let nonEmptySquaresCount = nonEmptySquares.length;
    // console.log(nonEmptySquaresCount);
    console.log(nonEmptySquares.pop())
    let rounds = 3;
    let i = 0;
    while (rounds > 0 && nonEmptySquaresCount > this.clueTarget()) {
      const x = nonEmptySquaresCount != 0 ? nonEmptySquares[i] : new Coordinate(0,0);
      console.log(x.row + " " + x.column);
      nonEmptySquaresCount--;
      i++;
      const removedSquare = this.chuot_bach_array[x.row][x.column];
      this.chuot_bach_array[x.row][x.column] = 0;
      const gridCopy = this.cloneDeep(this.chuot_bach_array);
      this.counter = 0;
      this.solvePuzzle(gridCopy);
      if (this.counter !== 1) {
        this.chuot_bach_array[x.row][x.column] = removedSquare;
        nonEmptySquaresCount++;
        rounds--;
      }
      console.log(this.chuot_bach_array);
    }
  }

}
