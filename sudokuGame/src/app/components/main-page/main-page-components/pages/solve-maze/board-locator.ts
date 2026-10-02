interface BoardPoint {
  x: number;
  y: number;
}

export interface LocatedBoard {
  image: HTMLCanvasElement;
  rows: number[] | null;
  cols: number[] | null;
}

interface CvMat {
  rows: number;
  cols: number;
  data: Uint8Array;
  data32S: Int32Array;
  intPtr(row: number, col?: number): Int32Array;
  roi(rect: object): CvMat;
  clone(): CvMat;
  delete(): void;
}

interface CvContourList {
  size(): number;
  get(index: number): CvMat;
  delete(): void;
}

interface RotatedRect {
  size: { width: number; height: number };
}

export interface OpenCvApi {
  COLOR_RGBA2GRAY: number;
  ADAPTIVE_THRESH_GAUSSIAN_C: number;
  THRESH_BINARY_INV: number;
  MORPH_RECT: number;
  MORPH_CLOSE: number;
  RETR_EXTERNAL: number;
  CHAIN_APPROX_SIMPLE: number;
  CV_32FC2: number;
  INTER_LINEAR: number;
  BORDER_CONSTANT: number;
  Mat: new () => CvMat;
  MatVector: new () => CvContourList;
  Size: new (width: number, height: number) => object;
  Scalar: new (v0: number, v1: number, v2: number, v3: number) => object;
  Rect: new (x: number, y: number, width: number, height: number) => object;
  imread(source: HTMLCanvasElement): CvMat;
  imshow(target: HTMLCanvasElement, mat: CvMat): void;
  cvtColor(src: CvMat, dst: CvMat, code: number): void;
  GaussianBlur(src: CvMat, dst: CvMat, ksize: object, sigma: number): void;
  adaptiveThreshold(
    src: CvMat,
    dst: CvMat,
    maxValue: number,
    adaptiveMethod: number,
    thresholdType: number,
    blockSize: number,
    c: number,
  ): void;
  getStructuringElement(shape: number, ksize: object): CvMat;
  morphologyEx(src: CvMat, dst: CvMat, op: number, kernel: CvMat): void;
  findContours(
    image: CvMat,
    contours: CvContourList,
    hierarchy: CvMat,
    mode: number,
    method: number,
  ): void;
  contourArea(contour: CvMat): number;
  arcLength(curve: CvMat, closed: boolean): number;
  approxPolyDP(curve: CvMat, approx: CvMat, epsilon: number, closed: boolean): void;
  minAreaRect(points: CvMat): RotatedRect;
  RotatedRect: { points(rect: RotatedRect): BoardPoint[] };
  matFromArray(rows: number, cols: number, type: number, array: number[]): CvMat;
  getPerspectiveTransform(src: CvMat, dst: CvMat): CvMat;
  warpPerspective(
    src: CvMat,
    dst: CvMat,
    matrix: CvMat,
    dsize: object,
    flags: number,
    borderMode: number,
    borderValue: object,
  ): void;
}

let openCvPromise: Promise<OpenCvApi> | null = null;

export function loadOpenCv(): Promise<OpenCvApi> {
  if (!openCvPromise) {
    openCvPromise = injectOpenCv().catch((error: unknown) => {
      openCvPromise = null;
      throw error;
    });
  }
  return openCvPromise;
}

// Finds the puzzle border, straightens it into a square, and returns that square.
// Returns null when no board is visible so the caller can keep the original photo.
export function locateSudokuBoard(photo: HTMLCanvasElement, cv: OpenCvApi): LocatedBoard | null {
  const trash: CvMat[] = [];
  const keep = <T extends CvMat>(mat: T): T => {
    trash.push(mat);
    return mat;
  };
  let contours: CvContourList | null = null;

  try {
    const src = keep(cv.imread(photo));
    const gray = keep(new cv.Mat());
    const blurred = keep(new cv.Mat());
    const threshold = keep(new cv.Mat());
    const closed = keep(new cv.Mat());
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);
    cv.adaptiveThreshold(
      blurred,
      threshold,
      255,
      cv.ADAPTIVE_THRESH_GAUSSIAN_C,
      cv.THRESH_BINARY_INV,
      15,
      4,
    );

    let kernelSize = Math.round(Math.min(src.rows, src.cols) / 80);
    if (kernelSize % 2 === 0) {
      kernelSize += 1;
    }
    kernelSize = Math.min(9, Math.max(3, kernelSize));
    const kernel = keep(cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(kernelSize, kernelSize)));
    cv.morphologyEx(threshold, closed, cv.MORPH_CLOSE, kernel);

    contours = new cv.MatVector();
    const hierarchy = keep(new cv.Mat());
    cv.findContours(closed, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    const corners = largestBoardCorners(cv, contours, src.rows * src.cols);
    if (!corners) {
      return null;
    }

    const size = 900;
    const source = keep(cv.matFromArray(4, 1, cv.CV_32FC2, flatten(orderCorners(corners))));
    const destination = keep(cv.matFromArray(4, 1, cv.CV_32FC2, [
      0, 0,
      size - 1, 0,
      size - 1, size - 1,
      0, size - 1,
    ]));
    const transform = keep(cv.getPerspectiveTransform(source, destination));
    const warped = keep(new cv.Mat());
    cv.warpPerspective(
      src,
      warped,
      transform,
      new cv.Size(size, size),
      cv.INTER_LINEAR,
      cv.BORDER_CONSTANT,
      new cv.Scalar(255, 255, 255, 255),
    );

    const square = document.createElement('canvas');
    square.width = size;
    square.height = size;
    cv.imshow(square, warped);
    const image = tightenToGrid(cv, square) ?? square;
    const lines = measureGridLines(cv, image);
    return {
      image,
      rows: lines?.rows ?? null,
      cols: lines?.cols ?? null,
    };
  } catch {
    return null;
  } finally {
    contours?.delete();
    for (const mat of trash) {
      mat.delete();
    }
  }
}

function tightenToGrid(cv: OpenCvApi, square: HTMLCanvasElement): HTMLCanvasElement | null {
  const trash: CvMat[] = [];
  const keep = <T extends CvMat>(mat: T): T => {
    trash.push(mat);
    return mat;
  };
  try {
    const src = keep(cv.imread(square));
    const gray = keep(new cv.Mat());
    const threshold = keep(new cv.Mat());
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    cv.adaptiveThreshold(
      gray,
      threshold,
      255,
      cv.ADAPTIVE_THRESH_GAUSSIAN_C,
      cv.THRESH_BINARY_INV,
      15,
      4,
    );
    const horizontal = peaks(project(threshold, 'row'), threshold.cols, 0.45);
    const vertical = peaks(project(threshold, 'col'), threshold.rows, 0.45);
    if (horizontal.length < 8 || vertical.length < 8) {
      return null;
    }
    const top = Math.max(0, horizontal[0] - 2);
    const bottom = Math.min(threshold.rows - 1, horizontal[horizontal.length - 1] + 2);
    const left = Math.max(0, vertical[0] - 2);
    const right = Math.min(threshold.cols - 1, vertical[vertical.length - 1] + 2);
    const width = right - left;
    const height = bottom - top;
    if (width < 200 || height < 200) {
      return null;
    }
    const view = src.roi(new cv.Rect(left, top, width, height));
    const cropped = keep(view.clone());
    view.delete();
    const tight = document.createElement('canvas');
    tight.width = width;
    tight.height = height;
    cv.imshow(tight, cropped);
    return tight;
  } catch {
    return null;
  } finally {
    for (const mat of trash) {
      mat.delete();
    }
  }
}

function measureGridLines(cv: OpenCvApi, image: HTMLCanvasElement): { rows: number[]; cols: number[] } | null {
  const trash: CvMat[] = [];
  const keep = <T extends CvMat>(mat: T): T => {
    trash.push(mat);
    return mat;
  };
  try {
    const src = keep(cv.imread(image));
    const gray = keep(new cv.Mat());
    const threshold = keep(new cv.Mat());
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    cv.adaptiveThreshold(
      gray,
      threshold,
      255,
      cv.ADAPTIVE_THRESH_GAUSSIAN_C,
      cv.THRESH_BINARY_INV,
      15,
      4,
    );
    let rows: number[] | null = null;
    let cols: number[] | null = null;
    for (const cutoff of [0.55, 0.4, 0.28]) {
      rows = selectGridLines(peaks(project(threshold, 'row'), threshold.cols, cutoff));
      cols = selectGridLines(peaks(project(threshold, 'col'), threshold.rows, cutoff));
      if (rows && cols) {
        break;
      }
    }
    if (!rows || !cols) {
      return null;
    }
    return {
      rows: loosenOuterLines(rows, threshold.rows),
      cols: loosenOuterLines(cols, threshold.cols),
    };
  } catch {
    return null;
  } finally {
    for (const mat of trash) {
      mat.delete();
    }
  }
}

function loosenOuterLines(lines: number[], limit: number): number[] {
  const copy = lines.slice();
  const gap = copy[1] - copy[0];
  const pad = Math.round(gap * 0.2);
  copy[0] = Math.max(0, copy[0] - pad);
  copy[copy.length - 1] = Math.min(limit - 1, copy[copy.length - 1] + pad);
  return copy;
}

function selectGridLines(found: number[]): number[] | null {
  if (found.length < 10) {
    return null;
  }
  if (found.length === 10) {
    return found;
  }
  let best: number[] | null = null;
  let bestSpread = Infinity;
  for (let start = 0; start + 10 <= found.length; start++) {
    const window = found.slice(start, start + 10);
    const gaps = window.slice(1).map((value, index) => value - window[index]);
    const mean = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
    if (mean < 12) {
      continue;
    }
    const variance = gaps.reduce((sum, gap) => sum + (gap - mean) ** 2, 0) / gaps.length;
    const spread = variance / (mean * mean);
    if (spread < bestSpread) {
      bestSpread = spread;
      best = window;
    }
  }
  return bestSpread < 0.15 ? best : null;
}

function project(binary: CvMat, axis: 'row' | 'col'): number[] {
  const totals = new Array<number>(axis === 'row' ? binary.rows : binary.cols).fill(0);
  const data = binary.data;
  for (let y = 0; y < binary.rows; y++) {
    for (let x = 0; x < binary.cols; x++) {
      if (data[y * binary.cols + x] > 0) {
        totals[axis === 'row' ? y : x]++;
      }
    }
  }
  return totals;
}

function peaks(totals: number[], span: number, cutoffRatio: number): number[] {
  const strongest = Math.max(...totals);
  const cutoff = strongest * cutoffRatio;
  const minGap = Math.max(8, Math.round(span / 20));
  const found: number[] = [];
  for (let index = 1; index < totals.length - 1; index++) {
    const value = totals[index];
    if (value < cutoff || value < totals[index - 1] || value < totals[index + 1]) {
      continue;
    }
    if (found.length === 0 || index - found[found.length - 1] > minGap) {
      found.push(index);
    } else if (value > totals[found[found.length - 1]]) {
      found[found.length - 1] = index;
    }
  }
  return found;
}

function largestBoardCorners(cv: OpenCvApi, contours: CvContourList, imageArea: number): BoardPoint[] | null {
  let best: BoardPoint[] | null = null;
  let bestArea = imageArea * 0.12;

  for (let index = 0; index < contours.size(); index++) {
    const contour = contours.get(index);
    const area = cv.contourArea(contour);
    if (area > bestArea) {
      const corners = fourCorners(cv, contour);
      if (corners && isUsableQuad(corners, imageArea)) {
        best = corners;
        bestArea = area;
      }
    }
    contour.delete();
  }

  return best;
}

function fourCorners(cv: OpenCvApi, contour: CvMat): BoardPoint[] | null {
  const perimeter = cv.arcLength(contour, true);
  for (const factor of [0.02, 0.04, 0.08, 0.12]) {
    const approx = new cv.Mat();
    cv.approxPolyDP(contour, approx, factor * perimeter, true);
    const points = readPoints(approx);
    approx.delete();
    if (points.length === 4 && isConvex(points)) {
      return points;
    }
  }

  const rect = cv.minAreaRect(contour);
  try {
    const rect = cv.minAreaRect(contour);
    const points = cv.RotatedRect.points(rect);
    if (points.length === 4 && isConvex(points) && rect.size.width > 40 && rect.size.height > 40) {
      return points;
    }
  } catch {
    return null;
  }
  return null;
}

function readPoints(approx: CvMat): BoardPoint[] {
  const points: BoardPoint[] = [];
  const values = approx.data32S;
  if (values && values.length >= approx.rows * 2) {
    for (let row = 0; row < approx.rows; row++) {
      points.push({ x: values[row * 2], y: values[row * 2 + 1] });
    }
    return points;
  }
  for (let row = 0; row < approx.rows; row++) {
    const ptr = approx.intPtr(row, 0);
    points.push({ x: ptr[0], y: ptr[1] });
  }
  return points;
}

function isConvex(points: BoardPoint[]): boolean {
  const turns: number[] = [];
  for (let index = 0; index < points.length; index++) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    const after = points[(index + 2) % points.length];
    turns.push((next.x - current.x) * (after.y - next.y) - (next.y - current.y) * (after.x - next.x));
  }
  return turns.every((turn) => turn > 0) || turns.every((turn) => turn < 0);
}

function isUsableQuad(points: BoardPoint[], imageArea: number): boolean {
  const area = polygonArea(points);
  if (area < imageArea * 0.12) {
    return false;
  }
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const width = Math.max(...xs) - Math.min(...xs);
  const height = Math.max(...ys) - Math.min(...ys);
  if (width < 80 || height < 80) {
    return false;
  }
  const ratio = Math.min(width, height) / Math.max(width, height);
  return ratio > 0.45;
}

function polygonArea(points: BoardPoint[]): number {
  let sum = 0;
  for (let index = 0; index < points.length; index++) {
    const next = points[(index + 1) % points.length];
    sum += points[index].x * next.y - next.x * points[index].y;
  }
  return Math.abs(sum) / 2;
}

function orderCorners(points: BoardPoint[]): BoardPoint[] {
  const sums = points.map((point) => point.x + point.y);
  const diffs = points.map((point) => point.y - point.x);
  return [
    points[indexOfExtreme(sums, Math.min)],
    points[indexOfExtreme(diffs, Math.min)],
    points[indexOfExtreme(sums, Math.max)],
    points[indexOfExtreme(diffs, Math.max)],
  ];
}

function indexOfExtreme(values: number[], pick: (...nums: number[]) => number): number {
  return values.indexOf(pick(...values));
}

function flatten(points: BoardPoint[]): number[] {
  return points.flatMap((point) => [point.x, point.y]);
}

function injectOpenCv(): Promise<OpenCvApi> {
  const existing = (globalThis as { cv?: unknown }).cv;
  if (existing) {
    return settleOpenCv(existing);
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = '/assets/opencv/opencv.js';
    script.async = true;
    script.onload = () => {
      settleOpenCv((globalThis as { cv?: unknown }).cv)
        .then(resolve)
        .catch(reject);
    };
    script.onerror = () => reject(new Error('OpenCV failed to load.'));
    document.body.appendChild(script);
  });
}

async function settleOpenCv(cvModule: unknown): Promise<OpenCvApi> {
  if (isThenable(cvModule)) {
    return settleOpenCv(await cvModule);
  }
  if (!cvModule || typeof cvModule !== 'object') {
    throw new Error('OpenCV failed to start.');
  }

  const cv = cvModule as OpenCvApi & { onRuntimeInitialized?: () => void };
  if (cv.Mat) {
    return cv;
  }
  await new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error('OpenCV failed to start.')), 20000);
    const previous = cv.onRuntimeInitialized;
    cv.onRuntimeInitialized = () => {
      window.clearTimeout(timer);
      previous?.();
      resolve();
    };
  });
  if (!cv.Mat) {
    throw new Error('OpenCV failed to start.');
  }
  return cv;
}

function isThenable(value: unknown): value is Promise<unknown> {
  return !!value && typeof (value as { then?: unknown }).then === 'function';
}
