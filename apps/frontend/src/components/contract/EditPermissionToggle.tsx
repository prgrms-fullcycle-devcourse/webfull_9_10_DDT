'use client';
import { Card, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Switch } from '../ui/switch';
import { useSocket } from '@/contexts/SocketContext';
import { useAuth } from '@/hooks/useAuth';
import { useRoomStore } from '@/store/useRoomStore';
import { Unlock, Lock } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';

/**
 * 각서 편집 권한 토글 컴포넌트. (방장 전용)
 * ON이면 전체 멤버 편집 가능, OFF이면 방장만 편집 가능합니다.
 * Socket.IO 'edit:all' 이벤트로 실시간 반영됩니다.
 */
const EditPermissionToggle = () => {
  const socket = useSocket();
  const me = useAuth().me;
  const { members, hostId } = useRoomStore(
    useShallow((s) => ({ members: s.members, hostId: s.hostId })),
  );

  const isHost = me?.id === hostId;

  // 방장 외 멤버 중 canEdit=false인 멤버가 있으면 "방장만 편집" 모드
  const hostOnly = Object.values(members).some(
    (m) => !m.isHost && m.canEdit === false,
  );

  const allCanEdit = !hostOnly;

  /**
   * 편집 권한 토글 핸들러.
   * Socket.IO로 'edit:all' 이벤트를 전송하여 전체 멤버의 canEdit을 일괄 변경합니다.
   *
   * @param checked - true면 전체 허용, false면 방장만
   */
  const handleToggle = (checked: boolean) => {
    if (!socket || !isHost) {
      return;
    }
    socket.emit('edit:all', { canEdit: checked });
  };
  return (
    <Card>
      <CardHeader>
        <div className='flex justify-between'>
          <CardTitle>각서 편집 권한</CardTitle>
          <Switch
            checked={allCanEdit}
            onCheckedChange={handleToggle}
            className='data-[state=unchecked]:bg-muted'
            disabled={!isHost}
            size='lg'
            thumbIcon={
              allCanEdit ? (
                <Unlock className='w-4 h-4 text-purple-600' />
              ) : (
                <Lock className='w-4 h-4 text-purple-600' />
              )
            }
          />
        </div>
        <CardDescription className='text-xs'>
          <p>현재 {hostOnly ? '방장만 편집 가능' : '모든 멤버가 편집 가능'}</p>
          <p>OFF 시 모든 멤버가 편집할 수 있어요.</p>
        </CardDescription>
      </CardHeader>
    </Card>
  );
};

export default EditPermissionToggle;
