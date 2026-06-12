'use client';
import { Card, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Switch } from '../ui/switch';
import { useSocket } from '@/contexts/SocketContext';
import { useAuth } from '@/hooks/useAuth';
import { useRoomStore } from '@/store/useRoomStore';
import { Unlock, Lock } from 'lucide-react';

const EditPermissionToggle = () => {
  const socket = useSocket();
  const me = useAuth().me;
  const members = useRoomStore((state) => state.members);
  const hostId = useRoomStore((state) => state.hostId);

  const isHost = me?.id === hostId;

  const hostOnly = Object.values(members).some(
    (m) => !m.isHost && m.canEdit === false,
  );

  const allCanEdit = !hostOnly;

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
          <CardTitle>계약서 편집 권한</CardTitle>
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
