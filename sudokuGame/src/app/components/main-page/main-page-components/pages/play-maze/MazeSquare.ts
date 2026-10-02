export class MazeSquare {
  value: any;
  isDisable: boolean;
  isClue: boolean;

  constructor(value: any, isDisable: boolean, isClue: boolean = false) {
    this.value = value;
    this.isDisable = isDisable;
    this.isClue = isClue;
  }
}
