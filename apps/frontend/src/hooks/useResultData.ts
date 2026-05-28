export interface MemberResult {
    id: string;
    name: string;
    rank: number;
    penaltyCount: number;
    isHost: boolean;
    isMe: boolean;
    isForfeit: boolean;
  }
  
  const MOCK_SUMMARY = {
    totalTime: '3시간 50분',
    completedSessions: '4 / 4',
  };
  
  const MOCK_MEMBERS: MemberResult[] = [
    { id: '1', name: '민지', rank: 1, penaltyCount: 2, isHost: true, isMe: false, isForfeit: true },
    { id: '2', name: '준호', rank: 2, penaltyCount: 1, isHost: false, isMe: false, isForfeit: false },
    { id: '3', name: '혜린', rank: 3, penaltyCount: 1, isHost: false, isMe: false, isForfeit: false },
    { id: '4', name: '영수', rank: 999, penaltyCount: 0, isHost: false, isMe: true, isForfeit: false },
    { id: '5', name: '지은', rank: 999, penaltyCount: 0, isHost: false, isMe: false, isForfeit: false },
  ];
  
  export function useResultData() {
    const myResult = MOCK_MEMBERS.find((member) => member.isMe);
    const isHost = myResult?.isHost ?? false;
    const hasMyPenalty = (myResult?.penaltyCount ?? 0) > 0;
  
    const penaltyUsersCount = MOCK_MEMBERS.filter((m) => m.rank !== 999).length;
    const isNoDisruption = penaltyUsersCount === 0;
  
    const shouldShowRoulette = isHost && hasMyPenalty && !isNoDisruption;
  
    return {
      summary: MOCK_SUMMARY,
      members: MOCK_MEMBERS,
      penaltyUsersCount,
      isNoDisruption,
      shouldShowRoulette,
    };
  }