type AuthMe = { id: string; role: string } | null;
type MemberLike = { userId: string | null; guestToken: string | null };

/**
 * 현재 로그인한 사용자가 특정 멤버와 동일 인물인지 판별합니다.
 * user는 userId로, guest는 guestToken으로 비교합니다.
 *
 * @param me - useAuth()에서 반환된 현재 사용자 정보
 * @param member - 비교 대상 멤버 객체 (userId, guestToken 필드 필요)
 * @returns 동일 인물이면 true
 */
export const isMeMember = (me: AuthMe, member: MemberLike): boolean => {
  if (!me) return false;
  return me.role === 'user'
    ? member.userId === me.id
    : member.guestToken === me.id;
};
