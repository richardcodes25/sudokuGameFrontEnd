import { Injectable } from '@angular/core';
import { loadOpenCv, locateSudokuBoard, LocatedBoard } from './board-locator';

export interface ScanProgress {
  phase: 'prepare' | 'locate' | 'read';
  done: number;
  total: number;
}

interface OcrModule {
  createWorker(
    langs: string,
    oem: number,
    options: Record<string, string>
  ): Promise<OcrWorker>;
  OEM: { LSTM_ONLY: number };
  PSM: { SINGLE_CHAR: string };
}

interface OcrWorker {
  setParameters(params: Record<string, string>): Promise<unknown>;
  recognize(image: string): Promise<{ data: { text: string; confidence: number } }>;
  terminate(): Promise<unknown>;
}

@Injectable({
  providedIn: 'root'
})
export class SudokuScanService {
  private workerPromise: Promise<OcrWorker> | null = null;
  private busy = false;

  async scan(file: File, onProgress?: (progress: ScanProgress) => void): Promise<string[][]> {
    if (this.busy) {
      throw new Error('A scan is already running.');
    }
    this.busy = true;
    try {
      onProgress?.({ phase: 'prepare', done: 0, total: 0 });
      const photo = await this.drawBoard(file);
      onProgress?.({ phase: 'locate', done: 0, total: 0 });
      const located = await this.locateBoard(photo);
      const cells = this.splitBoard(located);
      const inked = cells.filter((cell) => cell.image !== null);
      const worker = await this.worker();
      const grid = Array.from({ length: 9 }, () => Array<string>(9).fill(''));

      for (let index = 0; index < inked.length; index++) {
        const cell = inked[index];
        onProgress?.({ phase: 'read', done: index, total: inked.length });
        grid[cell.row][cell.col] = await this.readDigit(worker, cell.image as HTMLCanvasElement);
      }
      onProgress?.({ phase: 'read', done: inked.length, total: inked.length });
      return grid;
    } finally {
      this.busy = false;
    }
  }

  private async worker(): Promise<OcrWorker> {
    if (!this.workerPromise) {
      this.workerPromise = this.createWorker().catch((error: unknown) => {
        this.workerPromise = null;
        throw error;
      });
    }
    return this.workerPromise;
  }

  private async createWorker(): Promise<OcrWorker> {
    const loaded = (await import('tesseract.js')) as unknown as Partial<OcrModule> & { default?: OcrModule };
    const tesseract = loaded.createWorker && loaded.OEM && loaded.PSM ? loaded as OcrModule : loaded.default;
    if (!tesseract) {
      throw new Error('The scanner failed to start.');
    }
    const worker = await tesseract.createWorker('eng', tesseract.OEM.LSTM_ONLY, {
      workerPath: '/assets/tesseract/worker.min.js',
      corePath: '/assets/tesseract',
      langPath: '/assets/tesseract',
    });
    await worker.setParameters({
      tessedit_char_whitelist: '123456789',
      tessedit_pageseg_mode: tesseract.PSM.SINGLE_CHAR,
      classify_bln_numeric_mode: '1',
      user_defined_dpi: '300',
    });
    return worker;
  }

  private async locateBoard(photo: HTMLCanvasElement): Promise<LocatedBoard> {
    try {
      const cv = await loadOpenCv();
      return locateSudokuBoard(photo, cv) ?? { image: photo, rows: null, cols: null };
    } catch {
      return { image: photo, rows: null, cols: null };
    }
  }

  private drawBoard(file: File): Promise<HTMLCanvasElement> {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => {
        URL.revokeObjectURL(url);
        const maxSide = 1080;
        const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(9, Math.round(image.width * scale));
        canvas.height = Math.max(9, Math.round(image.height * scale));
        const context = canvas.getContext('2d');
        if (!context) {
          reject(new Error('The photo could not be prepared.'));
          return;
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas);
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('This photo could not be opened. Use a JPG or PNG of the board.'));
      };
      image.src = url;
    });
  }

  // Cells are cut between the detected grid lines. Each box is inset so the
  // line itself is not read as a digit.
  private splitBoard(board: LocatedBoard): Array<{ row: number; col: number; image: HTMLCanvasElement | null }> {
    const context = board.image.getContext('2d', { willReadFrequently: true });
    if (!context) {
      return [];
    }
    const useLines = board.rows?.length === 10 && board.cols?.length === 10;
    const cells = [];
    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        const bounds = useLines
          ? {
              x: board.cols![col],
              y: board.rows![row],
              width: board.cols![col + 1] - board.cols![col],
              height: board.rows![row + 1] - board.rows![row],
            }
          : {
              x: col * board.image.width / 9,
              y: row * board.image.height / 9,
              width: board.image.width / 9,
              height: board.image.height / 9,
            };
        const insetX = bounds.width * 0.1;
        const insetY = bounds.height * 0.1;
        const sx = Math.round(bounds.x + insetX);
        const sy = Math.round(bounds.y + insetY);
        const sw = Math.max(1, Math.round(bounds.width - insetX * 2));
        const sh = Math.max(1, Math.round(bounds.height - insetY * 2));
        const sample = context.getImageData(sx, sy, sw, sh);
        cells.push({
          row,
          col,
          image: this.hasInk(sample) ? this.prepareCell(sample) : null,
        });
      }
    }
    return cells;
  }

  private hasInk(sample: ImageData): boolean {
    const pixels = sample.data.length / 4;
    let luminanceTotal = 0;
    for (let i = 0; i < sample.data.length; i += 4) {
      luminanceTotal += this.luminance(sample.data, i);
    }
    const darkBackground = luminanceTotal / pixels < 128;
    let ink = 0;
    for (let i = 0; i < sample.data.length; i += 4) {
      const luminance = this.luminance(sample.data, i);
      if (darkBackground ? luminance > 170 : luminance < 145) {
        ink++;
      }
    }
    const ratio = ink / pixels;
    return ratio > 0.012 && ratio < 0.6;
  }

  private prepareCell(sample: ImageData): HTMLCanvasElement {
    const pixels = sample.data.length / 4;
    let luminanceTotal = 0;
    for (let i = 0; i < sample.data.length; i += 4) {
      luminanceTotal += this.luminance(sample.data, i);
    }
    const darkBackground = luminanceTotal / pixels < 128;

    const source = document.createElement('canvas');
    source.width = sample.width;
    source.height = sample.height;
    const sourceContext = source.getContext('2d');
    if (!sourceContext) {
      return source;
    }
    sourceContext.putImageData(sample, 0, 0);

    const size = 160;
    const pad = 24;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    if (!context) {
      return canvas;
    }
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, size, size);
    context.drawImage(source, pad, pad, size - pad * 2, size - pad * 2);

    const image = context.getImageData(0, 0, size, size);
    for (let i = 0; i < image.data.length; i += 4) {
      let luminance = this.luminance(image.data, i);
      if (darkBackground) {
        luminance = 255 - luminance;
      }
      const value = luminance < 165 ? 0 : 255;
      image.data[i] = value;
      image.data[i + 1] = value;
      image.data[i + 2] = value;
      image.data[i + 3] = 255;
    }
    context.putImageData(image, 0, 0);
    return canvas;
  }

  private async readDigit(worker: OcrWorker, cell: HTMLCanvasElement): Promise<string> {
    const result = await worker.recognize(cell.toDataURL('image/png'));
    const digit = (result.data.text.match(/[1-9]/) ?? [''])[0];
    if (!digit || result.data.confidence < 20) {
      return '';
    }
    return digit;
  }

  private luminance(data: Uint8ClampedArray, index: number): number {
    return data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114;
  }
}
