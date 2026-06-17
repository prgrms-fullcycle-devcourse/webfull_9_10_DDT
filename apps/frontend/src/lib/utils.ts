import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * 조건부 className을 합치고 Tailwind 충돌 클래스를 정리(뒤 값 우선)해 최종 문자열을 반환한다.
 *
 * @param inputs - clsx가 받는 className 값들 (문자열·객체·배열·falsy)
 * @returns twMerge로 중복 제거된 className 문자열
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * URL-safe Base64 문자열을 Uint8Array로 변환한다. (웹푸시 VAPID 공개키 등 디코딩용)
 *
 * @param base64String - URL-safe Base64 문자열
 * @returns 디코딩된 바이트 배열
 */
export function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}