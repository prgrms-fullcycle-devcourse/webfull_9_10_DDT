import { Badge } from '../ui/badge';
import { Card, CardDescription, CardHeader, CardTitle } from '../ui/card';

interface RoomTitleProps {
  title: string;
  code: string;
  isConnected: boolean;
}

export default function RoomTitle({
  title,
  code,
  isConnected,
}: RoomTitleProps) {
  return (
    <Card>
      <CardHeader>
        <div className='flex justify-between items-center'>
          <CardTitle className=''>{title}</CardTitle>
          <Badge variant={isConnected ? 'default' : 'destructive'}>
            {isConnected ? '실시간 연결됨' : '연결 시도 중...'}
          </Badge>
        </div>
        <CardDescription className='text-xs'>
          <p>방 코드: {code}</p>
          <p>함께 규칙을 정하고 서명하세요.</p>
        </CardDescription>
      </CardHeader>
    </Card>
  );
}
