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

/**
 * Enter 키 입력 시 해당 input에서 포커스를 제거합니다.
 * 모바일에서 소프트 키보드가 내려가는 효과를 냅니다.
 * 한글 등 IME 조합 중(isComposing)에는 동작하지 않습니다.
 *
 * @param e - 키보드 이벤트
 */
export function blurOnEnter(
  e: React.KeyboardEvent<HTMLInputElement>,
): void {
  if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
    e.preventDefault();
    (e.target as HTMLInputElement).blur();
  }
}
