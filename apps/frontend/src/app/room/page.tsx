import { RequireAuth } from '@/components/auth/RequireAuth';
import { CreateRoom } from '@/components/room/CreateRoom';

export default function CreateRoomPage() {

  return (
    <RequireAuth>
      <CreateRoom />
    </RequireAuth>
  );
}
