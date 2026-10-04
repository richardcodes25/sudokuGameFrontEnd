export class MazeSquare {
  value: any;
  isDisable: boolean;
  isClue: boolean;
  isWrong: boolean;
  isNote: boolean;
  notes: boolean[];

  constructor(value: any, isDisable: boolean, isClue: boolean = false) {
    this.value = value;
    this.isDisable = isDisable;
    this.isClue = isClue;
    this.isWrong = false;
    this.isNote = false;
    this.notes = Array.from({ length: 9 }, () => false);
  }

  clearNotes(): void {
    this.isNote = false;
    this.notes = Array.from({ length: 9 }, () => false);
  }
}
