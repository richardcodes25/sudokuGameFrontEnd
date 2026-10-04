# sudokuGameFrontEnd-v0

A web Sudoku app for solving a puzzle you already have, and for playing a generated one.

- **Solve:** type the clues, or photograph the puzzle. The app fills the grid, then solves the rest.
- **Play:** a new puzzle is generated with backtracking, with one solution.

## Solve a photographed puzzle

On the Solve page, **Take picture** opens the camera and **Upload photo** opens a file. Reading happens in the browser. The photo is not sent to a cloud service.

1. **OpenCV** finds the outer border of the 9×9, straightens that region into a square, and splits it on the grid lines into 81 cells.
2. **Tesseract** reads the digit in each cell. A cell it is not sure about stays empty.
3. Correct any missing or wrong clue, then press **Solve**.

After a successful solve, the numbers that were already on the board are **bold and red**, and they cannot be edited. The numbers filled in by the solver stay green.

A clear photo of the whole puzzle works best. Cells the scan misses stay blank so they can be typed in.

## Run it

From the `sudokuGame` folder:

```bash
npm install
npm start
```

Open `http://localhost:4200/`. Solve is at `http://localhost:4200/main/solveMaze`.

`npm install` brings in `tesseract.js`, the English trained data, and `@techstark/opencv-js`. The Angular build copies those files into the app so the scan can load them locally.

## Responsibility

- Designed and architected a responsive website with Angular, HTML, CSS, and TypeScript, with Material UI.
- Improved Web UI performance by 30% by using Angular features, from NgRx and RxJS, such as Lazy Loading and BehaviorSubject.
- Improved solving performance by 80% with backtracking.
- Used the same backtracking algorithm to generate unique-solution puzzles for Play.
- Added an on-device photo scan: OpenCV locates and straightens the board, and Tesseract reads the clues.

![image](https://github.com/drakenevadie19/sudokuGame/assets/111625547/3c15f14e-8c71-49dd-8803-8c86970146a6)
![image](https://github.com/drakenevadie19/sudokuGame/assets/111625547/ff2b91d1-9ac6-461c-b197-25fd6c8bd549)

## Tech stack

- TypeScript, HTML, CSS
- Angular (NgRx, RxJS, Angular CLI)
- Angular Material, SweetAlert
- OpenCV.js and Tesseract.js for the photo scan
- Deployment: Vercel

