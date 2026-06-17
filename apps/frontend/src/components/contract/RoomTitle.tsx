import { Badge } from '../ui/badge';
import { Card, CardDescription, CardHeader, CardTitle } from '../ui/card';

interface RoomTitleProps {
  title: string;
  code: string;
  isConnected: boolean;
}

/**
 * 방 제목 + Yjs 연결 상태 + 방 코드를 표시하는 카드 컴포넌트.
 * 계약서(각서) 페이지 상단에 배치됩니다.
 * 연결 상태에 따라 "실시간 연결됨"(초록) 또는 "연결 시도 중..."(빨강) 뱃지를 표시합니다.
 *
 * @param title - 방 제목
 * @param code - 방 코드 (사용자에게 표시)
 * @param isConnected - Yjs WebSocket 연결 여부
 */
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
          <p>함께 각서를 쓰고 서명하세요.</p>
        </CardDescription>
      </CardHeader>
    </Card>
  );
}
