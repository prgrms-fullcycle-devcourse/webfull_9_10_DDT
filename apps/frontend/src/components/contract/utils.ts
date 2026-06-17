/**
 * 자연수만 허용하는 키 입력 필터.
 * 소수점(.), 부호(+/-), 지수(e/E) 키를 차단합니다.
 *
 * @param e - 키보드 이벤트
 */
export function blockNonInteger(
  e: React.KeyboardEvent<HTMLInputElement>,
): void {
  if (['e', 'E', '+', '-', '.'].includes(e.key)) {
    e.preventDefault();
  }
}
