import { Component, ElementRef, NgZone, QueryList, ViewChildren } from '@angular/core';
import { ShareService } from 'src/app/share.service';
import Swal from 'sweetalert2';
import { SudokuScanService } from './sudoku-scan.service';

@Component({
  selector: 'app-solve-maze',
  templateUrl: './solve-maze.component.html',
  styleUrls: ['./solve-maze.component.scss']
})

export class SolveMazeComponent {
  @ViewChildren('cellInput') cellInputs!: QueryList<ElementRef<HTMLInputElement>>;

  mazeList : any[][];
  selectedRow = -1;
  selectedCol = -1;
  soluong:number = 9;
  isDisabled: boolean = false;
  // input: string = "________4,1____9_7_,__37_28__,____7_26_,4_______8,_91_6____,__42_36__,_3_14___9,9________";
  // x: String[] = [];
  canBesolve: boolean = true;
  isSolve: boolean = false;
  scanning = false;
  scanMessage = '';
  scanTone: 'info' | 'ok' | 'bad' = 'info';
  given: boolean[][] = [];

  constructor(
    private shareService: ShareService,
    private scanService: SudokuScanService,
    private zone: NgZone,
  ) {
    this.mazeList = [];
    this.shareService.maze = [
      [0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0]
    ];


    // Define specific number of elements in each row
    const elementsInEachRow = this.soluong;

    // Initialize the array with certain number of rows
    const numRows = this.soluong;

    for (let i = 0; i < numRows; i++) {
      this.mazeList[i] = Array(elementsInEachRow).fill(""); // Replace 0 with the default value you want for each element
    }
    this.given = this.emptyGiven();

    // console.log(this.mazeList);
  }

  ngOnInit() {
    if (this.shareService.maze) {
      this.fillMatrix();
    } else {
      console.error("Maze data is not available yet.");
    }
  }

  trackByIndex(index: number): number {
    return index;
  }

  isGiven(row: number, col: number): boolean {
    return !!this.given[row]?.[col];
  }

  displayValue(value: any): string {
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
    if (this.isDisabled) {
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
    if (this.isDisabled) {
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
    if (this.isDisabled) {
      return;
    }
    const digit = (event.clipboardData?.getData('text') ?? '').trim().charAt(0);
    if (/^[1-9]$/.test(digit)) {
      this.commitCell(event.target as HTMLInputElement, row, col, digit);
    }
  }

  private commitCell(input: HTMLInputElement, row: number, col: number, value: string): void {
    this.mazeList[row][col] = value;
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

  fillMatrix() {
    console.log(this.shareService.maze);
    if (this.shareService.maze && Array.isArray(this.shareService.maze)) {
      for (let i = 0; i < 9; i++) {
        this.mazeList[i] = [];
        for (let j = 0; j < 9; j++) {
          if (this.shareService.maze[i] && this.shareService.maze[i][j] === 0) {
            this.mazeList[i][j] = "";
          } else if (this.shareService.maze[i] && this.shareService.maze[i][j] != null) {
            this.mazeList[i][j] = this.shareService.maze[i][j];
          } else {
            this.mazeList[i][j] = ""; // Fallback to default value
          }
        }
      }
    } else {
      console.error("shareService.maze is not properly initialized.");
    }
  }

  onScanSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || this.scanning) {
      return;
    }
    void this.readPuzzle(file);
  }

  private async readPuzzle(file: File): Promise<void> {
    this.scanning = true;
    this.isDisabled = true;
    this.isSolve = false;
    this.canBesolve = true;
    this.scanTone = 'info';
    this.scanMessage = 'Preparing the photo…';
    try {
      const grid = await this.scanService.scan(file, (progress) => {
        this.zone.run(() => {
          if (progress.phase === 'locate') {
            this.scanMessage = 'Finding the puzzle…';
          } else if (progress.phase === 'prepare' || progress.total === 0) {
            this.scanMessage = 'Preparing the photo…';
          } else {
            this.scanMessage = `Reading digits ${progress.done} of ${progress.total}…`;
          }
        });
      });
      this.zone.run(() => this.applyScannedGrid(grid));
    } catch {
      this.zone.run(() => {
        this.scanTone = 'bad';
        this.scanMessage = 'The photo could not be read. Use a clear photo of the puzzle.';
        this.isDisabled = false;
      });
    } finally {
      this.zone.run(() => {
        this.scanning = false;
      });
    }
  }

  private applyScannedGrid(grid: string[][]): void {
    let found = 0;
    for (let row = 0; row < 9; row++) {
      this.mazeList[row] = [];
      for (let col = 0; col < 9; col++) {
        const digit = grid[row][col];
        this.mazeList[row][col] = digit;
        if (digit) {
          found++;
        }
      }
    }
    this.given = this.emptyGiven();
    this.isDisabled = false;
    this.isSolve = false;
    this.canBesolve = true;
    if (found === 0) {
      this.scanTone = 'bad';
      this.scanMessage = 'No digits were found. Fill the frame with the board and try again.';
      return;
    }
    this.scanTone = 'ok';
    this.scanMessage = `Filled ${found} cells. Correct any mistakes, then press Solve.`;
  }

  clearMaze() {
    this.canBesolve = true;
    this.isSolve = false;
    this.scanMessage = '';
    this.scanTone = 'info';
    this.given = this.emptyGiven();

    this.mazeList = [];
    // Define specific number of elements in each row
    const elementsInEachRow = this.soluong;

    // Initialize the array with certain number of rows
    const numRows = this.soluong;

    for (let i = 0; i < numRows; i++) {
      this.mazeList[i] = Array(elementsInEachRow).fill(""); // Replace 0 with the default value you want for each element
    }
    this.isDisabled = false;
    console.clear();
  }

  printMaze() {
    console.log(this.mazeList);
  }

  //-----------------------------------------------------------------
  //Processing core
  r: number = 0;
  c: number = 0;
  board: number[][] = [];
  count: number = 0;

  solveMaze() {
    this.scanMessage = '';
    const clues = this.captureGivens();
    console.log(this.mazeList);
    if (this.solve(this.mazeList, 0 ,0)) {
      this.given = clues;
      Swal.fire({
        icon: 'success',
        title: 'We finish it!!',
        showConfirmButton: true,
        timer: 25060,
        allowOutsideClick: true,
        allowEscapeKey: true
      })
      this.isSolve = true;
      this.canBesolve = true;
      this.isDisabled = true;
    } else {
      console.log("Solve Failed");
      this.isSolve = false;
      this.canBesolve = false;
    }
    console.log(this.mazeList);
  }

  solve(mazeList: number[][], r: number, c: number): boolean {
    if(c===9 && r === 8) {
      return true;
    }

    if(c === 9){
        c = 0;
        r++;
    }

    if (mazeList[r][c] != 0) {
      return this.solve(mazeList, r, c + 1);
    } else {
      for(let i = 1; i <= 9; i++){
        if(this.isValid(mazeList, r, c, i)){
          mazeList[r][c] = i;
          if(this.solve(mazeList, r, c+1)) return true;
        }
        mazeList[r][c] = 0;
      }
    }

    return false;
  }

  isValid(mazeList: number[][], r: number, c: number, val: number): boolean{
    for(let c1 = 0; c1 < 9; c1++) {
        if(c1 != c && val == mazeList[r][c1]) return false;
    }

    for(let r1 = 0; r1 < 9; r1++) {
        if(r1 != r && val == mazeList[r1][c]) return false;
    }

    let start_r = r - r%3;
    let start_c = c - c%3;
    for(let r1 = 0; r1 < 3; r1++){
        for(let c1 = 0; c1 < 3; c1++){
            if(r1 != r && c1 != c && val == mazeList[r1+start_r][c1+start_c]) return false;
        }
    }

    return true;
  }

  private emptyGiven(): boolean[][] {
    return Array.from({ length: 9 }, () => Array<boolean>(9).fill(false));
  }

  private captureGivens(): boolean[][] {
    return this.mazeList.map((row) => row.map((cell) => this.displayValue(cell) !== ''));
  }
}
