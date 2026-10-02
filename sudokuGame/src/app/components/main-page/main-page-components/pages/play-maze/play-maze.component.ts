import { Component, ElementRef, HostListener, QueryList, ViewChildren } from '@angular/core';
import Swal from 'sweetalert2';
import { MazeSquare } from './MazeSquare';
import { ShareService } from 'src/app/share.service';

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

export class PlayMazeComponent {
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
  screen: 'menu' | 'play' = 'menu';
  playMode: 'friend' | 'computer' = 'friend';
  dialog: 'none' | 'account' | 'signin' | 'setup' = 'none';
  difficulty: 'easy' | 'medium' | 'hard' = 'medium';
  timerMode: 'stopwatch' | 'countdown' = 'stopwatch';
  countdownMinutes = 15;
  countdownChoices = [10, 15, 30, 45];
  countdownTotal = 15 * 60;
  remaining = 15 * 60;
  timeUp = false;
  signedIn = false;
  signInEmail = '';
  signInPassword = '';
  second: string = "0";
  minute: string = "0";
  hour: string = "0";
  sec: number = 0;
  min: number = 0;
  hr: number = 0;

  checkButtonDisable: boolean= false;

  constructor(private shareService: ShareService) {
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

  trackByIndex(index: number): number {
    return index;
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
    this.mazeList[row][col].value = value;
    if (input) {
      input.value = value;
    }
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
    this.playMode = 'friend';
    this.timerMode = 'stopwatch';
    this.dialog = 'none';
    this.screen = 'play';
    this.resetClock();
  }

  chooseComputer(): void {
    this.playMode = 'computer';
    this.dialog = 'account';
  }

  continueAsGuest(): void {
    this.signedIn = false;
    this.dialog = 'setup';
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
    this.dialog = 'setup';
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
    this.dialog = 'none';
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.dialog !== 'none') {
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
    if (this.playMode !== 'computer') {
      return 36;
    }
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
    if (this.timeUp) {
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

    for (let i = 0; i < 9; i++) {
      for (let j = 0; j< 9;j++) {
        this.mazeList[i][j].value = "";
        this.mazeList[i][j].isDisable = true;
        this.mazeList[i][j].isClue = false;
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
    this.generatePuzzle();
    for (let i = 0; i < 9; i++) {
      for (let j = 0; j< 9;j++) {
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
