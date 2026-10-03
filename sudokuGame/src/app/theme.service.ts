import { Injectable } from '@angular/core';

export type AppTheme = 'forest' | 'pastel';

const STORAGE_KEY = 'sudoku-theme';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private theme: AppTheme = 'forest';

  constructor() {
    this.apply(this.readSaved(), false);
  }

  get isPastel(): boolean {
    return this.theme === 'pastel';
  }

  toggle(): void {
    this.apply(this.theme === 'pastel' ? 'forest' : 'pastel', true);
  }

  private readSaved(): AppTheme {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'pastel' ? 'pastel' : 'forest';
    } catch {
      return 'forest';
    }
  }

  private apply(theme: AppTheme, persist: boolean): void {
    this.theme = theme;
    document.documentElement.dataset['theme'] = theme;
    if (!persist) {
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Storage can be unavailable in private browsing.
    }
  }
}
