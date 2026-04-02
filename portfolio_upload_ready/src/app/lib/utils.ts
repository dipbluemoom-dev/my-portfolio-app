import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// ===== CSS 유틸 (shadcn/ui용) =====

/** Tailwind 클래스를 안전하게 병합합니다. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ===== localStorage 유틸 =====

/**
 * localStorage에서 JSON을 안전하게 파싱합니다.
 * 값이 없거나 파싱 실패 시 fallback을 반환합니다.
 * @example const data = readJson('bankAccounts', { accounts: [] });
 */
export const readJson = <T>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

/** 숫자로 변환 불가능한 값을 0으로 처리합니다. */
export const toNumber = (v: unknown): number =>
  Number.isFinite(Number(v)) ? Number(v) : 0;

/**
 * <input type="number" value={...} /> 에 넘길 문자열을 반환합니다.
 * 값이 0이면 빈 문자열을 반환해서 placeholder가 보이도록 합니다.
 */
export const numInputValue = (value: number): string =>
  value === 0 ? '' : String(value);
