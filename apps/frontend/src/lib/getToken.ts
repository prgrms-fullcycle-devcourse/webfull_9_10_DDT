export function getToken(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/access_token=([^;]+)/);
  return match ? match[1] : null;
}
