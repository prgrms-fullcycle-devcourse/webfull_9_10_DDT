type AuthMe = { id: string; role: string } | null;
type MemberLike = { userId: string | null; guestToken: string | null };

export const isMeMember = (me: AuthMe, member: MemberLike): boolean => {
  if (!me) return false;
  return me.role === 'user'
    ? member.userId === me.id
    : member.guestToken === me.id;
};
