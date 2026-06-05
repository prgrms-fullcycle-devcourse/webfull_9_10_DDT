import axios from 'axios';

/**
 * API 에러에서 사용자에게 보여줄 메시지를 안전하게 추출한다.
 * - Axios 에러면 서버가 내려준 message를 우선 사용
 * - 서버 message가 없거나 일반 Error면 fallback 사용
 * - message가 undefined로 새어나가지 않도록 항상 문자열을 보장한다.
 */
export function getErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const serverMessage = (err.response?.data as { message?: string } | undefined)
      ?.message;
    if (serverMessage) return serverMessage;
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}
