# SudokuGame

Angular app for playing a generated Sudoku puzzle and for solving one you enter or photograph. Generated with [Angular CLI](https://github.com/angular/angular-cli) 16.0.4.

## Development server

Install dependencies, then start the app from this folder:

```bash
npm install
npm start
```

`npm start` runs `ng serve`. Open `http://localhost:4200/`. The Solve page is at `http://localhost:4200/main/solveMaze`. The app reloads when you change a source file.

## Photo scan

**Take picture** and **Upload photo** on the Solve page read a printed puzzle in the browser.

- `@techstark/opencv-js` finds the board, straightens it, and cuts it into 81 cells along the grid lines.
- `tesseract.js` and `@tesseract.js-data/eng` read the digits. Unsure cells stay empty.
- Press **Solve** after correcting the grid. Clues that were already filled are shown in bold red and cannot be edited. Solved cells stay green.

The Angular build copies `opencv.js`, the Tesseract worker, and `eng.traineddata.gz` into the app assets. The first scan loads those files from the app itself.

Use a clear photo of the whole puzzle. Cells the scan misses can be typed in before solving.

## Build

`ng build` writes the production build to `dist/`.

## Tests

`ng test` runs the unit tests with [Karma](https://karma-runner.github.io).

## Further help

`ng help`, or the [Angular CLI command reference](https://angular.io/cli).
