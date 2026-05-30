'use client';
import { Card, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Switch } from '../ui/switch';
import { useSocket } from '@/contexts/SocketContext';
import { useAuthStore } from '@/store/useAuthStore';
import { useRoomStore } from '@/store/useRoomStore';

const EditPermissionToggle = () => {
  const socket = useSocket();
  const me = useAuthStore((state) => state.me);
  const members = useRoomStore((state) => state.members);
  const hostId = useRoomStore((state) => state.hostId);

  const isHost = me?.id === hostId;

  const hostOnly = Object.values(members).some(
    (m) => !m.isHost && m.canEdit === false,
  );

  const handleToggle = (checked: boolean) => {
    if (!socket) {
      return;
    }
    if (!isHost) return;

    socket.emit('edit:all', { canEdit: !checked });
  };
  return (
    <Card>
      <CardHeader>
        <div className='flex justify-between'>
          <CardTitle>계약서 편집 권한</CardTitle>
          <Switch
            checked={hostOnly}
            onCheckedChange={handleToggle}
            className='data-[state=unchecked]:bg-muted'
            disabled={!isHost}
          />
        </div>
        <CardDescription>
          {hostOnly ? '방장만 편집 가능' : '모든 멤버가 편집 가능'}
        </CardDescription>
        <CardDescription>OFF 시 모든 멤버가 편집할 수 있어요.</CardDescription>
      </CardHeader>
    </Card>
  );
};

export default EditPermissionToggle;
