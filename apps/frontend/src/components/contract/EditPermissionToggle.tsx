'use client';
import { useState } from 'react';
import { Card, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Switch } from '../ui/switch';

const EditPermissionToggle = () => {
  const [hostOnly, setHostOnly] = useState(false);
  return (
    <Card>
      <CardHeader>
        <div className='flex justify-between'>
          <CardTitle>계약서 편집 권한</CardTitle>
          <Switch
            checked={hostOnly}
            onCheckedChange={setHostOnly}
            className='data-[state=unchecked]:bg-muted'
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
