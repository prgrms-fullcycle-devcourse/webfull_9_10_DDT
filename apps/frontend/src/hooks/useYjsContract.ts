'use client';
import {
  ApplyData,
  AwarenessState,
  ContractFields,
  FocusedField,
  Penalty,
  Tier,
  UseContractYjsReturn,
} from '@/types/yjs';
import { useCallback, useEffect, useRef, useState } from 'react';
import * as Y from 'yjs';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { WebsocketProvider } = require('y-websocket');

function generateColor(userId: string): string {
  const colors = ['#FF5733', '#33FF57', '#3357FF', '#FF33A1', '#33FFF5'];
  const index = userId.charCodeAt(0) % colors.length;
  return colors[index];
}

import { v4 as uuid } from 'uuid';
import { getToken } from '@/lib/getToken';
import { useSocket } from '@/contexts/SocketContext';

/**
 * 계약서(타이머 설정·벌칙·강도 단계)를 Yjs + WebSocket으로 실시간 공동 편집하는 훅.
 * y-websocket으로 방별 문서에 연결해 fields/tiers/penalties를 동기화하고,
 * awareness로 다른 참가자가 어떤 필드를 편집 중인지(focusedField) 공유한다.
 *
 * @param roomCode - 연결할 방 코드 (Yjs 문서 식별자)
 * @param enabled - true일 때만 연결/동기화 수행 (예: 계약서 단계에서만)
 * @param isHost - 방장 여부. 최초 sync 시 기본 1단계 시드 등 방장 전용 초기화에 사용
 * @returns 동기화된 fields·tiers·penalties, 편집 권한 표시용 fieldOwners, 연결 상태(isConnected),
 *          그리고 각 항목을 갱신하는 핸들러(updateField·addTier·addPenalty 등)와 포커스 핸들러
 */
export function useYjsContract(
  roomCode: string,
  enabled: boolean,
  isHost: boolean,
): UseContractYjsReturn {
  const socket = useSocket();
  const socketRef = useRef(socket);
  const docRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<typeof WebsocketProvider | null>(null);

  const [isConnected, setIsConnected] = useState(false);
  const [fields, setFields] = useState<ContractFields>({
    focusMin: 1,
    breakMin: 1,
    rounds: 1,
  });
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [penalties, setPenalties] = useState<Penalty[]>([]);
  const [fieldOwners, setFieldOwners] = useState<Record<string, FocusedField>>(
    {},
  );
  const [debouncedEnabled, setDebouncedEnabled] = useState(false);

  const yjsFieldsRef = useRef<Y.Map<number> | null>(null);
  const yjsTiersRef = useRef<Y.Array<Tier> | null>(null);
  const yjsPenaltiesRef = useRef<Y.Array<Penalty> | null>(null);

  // enabled가 켜진 직후 바로 연결하지 않고 150ms 디바운스한다.
  // 짧은 순간 enabled가 깜빡(마운트/언마운트·리렌더)일 때 WebSocket 연결을 즉시 맺었다 끊는 낭비를 막는다.
  useEffect(() => {
    if (!enabled) return;
    const timer = setTimeout(() => setDebouncedEnabled(true), 150);
    return () => {
      clearTimeout(timer);
      setDebouncedEnabled(false);
    };
  }, [enabled]);

  // isHost는 effect 재실행을 피하기 위해 ref로 추적한다.
  const isHostRef = useRef(isHost);
  useEffect(() => {
    isHostRef.current = isHost;
  }, [isHost]);

  useEffect(() => {
    socketRef.current = socket;
  }, [socket]);

  useEffect(() => {
    if (!roomCode || !enabled) {
      return;
    }

    const doc = new Y.Doc();

    docRef.current = doc;

    yjsFieldsRef.current = doc.getMap<number>('fields');
    yjsTiersRef.current = doc.getArray<Tier>('tiers');
    yjsPenaltiesRef.current = doc.getArray<Penalty>('penalties');

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
    const wsUrl = apiUrl.replace(/^http/, 'ws');
    const token = getToken() ?? '';
    const serverUrl = `${wsUrl}/yjs?roomCode=${roomCode}&token=${token}`;

    if (!token) return;

    const provider = new WebsocketProvider(serverUrl, '', doc);
    const awareness = provider.awareness;

    // awareness: 누가 어떤 필드를 편집 중인지 공유한다. 내 클라이언트(clientID)는 제외하고
    // 다른 참가자들의 focusedField만 모아 "필드별 점유자(owners)" 맵으로 만든다. (편집 중 표시·잠금용)
    const handleAwarenessChange = () => {
      const owners: Record<string, FocusedField> = {};

      (awareness.getStates() as Map<number, AwarenessState>).forEach(
        (state, clientId) => {
          if (clientId === awareness.clientID) return;
          if (state.focusedField) {
            owners[state.focusedField.fieldKey] = state.focusedField;
          }
        },
      );

      setFieldOwners(owners);
    };

    awareness.on('change', handleAwarenessChange);

    providerRef.current = provider;

    provider.on('status', ({ status }: { status: string }) => {
      console.log('연결 상태:', status);
      setIsConnected(status === 'connected');
    });

    // 최초 동기화 완료 시점: 서버에 쌓여 있던 문서 내용을 로컬 state로 한 번 끌어온다.
    provider.on('sync', (isSynced: boolean) => {
      if (!isSynced) return;

      if (yjsFieldsRef.current) {
        setFields({
          focusMin: yjsFieldsRef.current.get('focusMin') ?? 1,
          breakMin: yjsFieldsRef.current.get('breakMin') ?? 1,
          rounds: yjsFieldsRef.current.get('rounds') ?? 1,
        });
      }
      if (yjsTiersRef.current) {
        setTiers(yjsTiersRef.current.toArray());
      }
      if (yjsPenaltiesRef.current) {
        setPenalties(yjsPenaltiesRef.current.toArray());
      }
      // 빈 문서에 기본 1단계(0~100%)를 시드한다. 방장만 1회 수행해, 모든 참가자가 동시에
      // 시드를 push 해 단계가 중복 생성되는 것을 막는다. (문서는 동기화되므로 다른 참가자는 받기만 함)
      if (
        yjsTiersRef.current &&
        yjsTiersRef.current.length === 0 &&
        isHostRef.current
      ) {
        doc.transact(() => {
          yjsTiersRef.current!.push([
            {
              tier: 1,
              minPct: 0,
              maxPct: null,
              count: 0,
            },
          ]);
        });
      }
    });

    // 문서 변경을 구독해 로컬 state에 반영한다. (내 편집·원격 편집 모두)
    // transaction.local일 때만 'contract:edited'를 emit한다 — 내가 바꾼 경우에만 서버에 알려
    // 원격 변경을 다시 알림으로 되쏘는 무한 루프를 막는다. (tiers·penalties observe도 동일 패턴)
    yjsFieldsRef.current.observe((event) => {
      if (yjsFieldsRef.current) {
        if (event.transaction.local) {
          socketRef.current?.emit('contract:edited');
        }
        setFields({
          focusMin: yjsFieldsRef.current.get('focusMin') ?? 1,
          breakMin: yjsFieldsRef.current.get('breakMin') ?? 1,
          rounds: yjsFieldsRef.current.get('rounds') ?? 1,
        });
      }
    });

    yjsTiersRef.current.observe((event) => {
      if (yjsTiersRef.current) {
        if (event.transaction.local) {
          socketRef.current?.emit('contract:edited');
        }
        setTiers(yjsTiersRef.current.toArray());
      }
    });

    yjsPenaltiesRef.current.observe((event) => {
      if (yjsPenaltiesRef.current) {
        if (event.transaction.local) {
          socketRef.current?.emit('contract:edited');
        }
        setPenalties(yjsPenaltiesRef.current.toArray());
      }
    });

    return () => {
      awareness.off('change', handleAwarenessChange);
      provider.destroy();
      doc.destroy();
      docRef.current = null;
      providerRef.current = null;
      yjsFieldsRef.current = null;
      yjsTiersRef.current = null;
      yjsPenaltiesRef.current = null;
      setIsConnected(false);
    };
  }, [roomCode, enabled, debouncedEnabled]);

  const handleFocus = useCallback(
    (fieldKey: string, userId: string, nickname: string) => {
      const provider = providerRef.current;
      if (!provider) {
        return;
      }

      provider.awareness.setLocalStateField('focusedField', {
        fieldKey,
        userId,
        nickname,
        color: generateColor(userId),
      });
    },
    [],
  );

  const handleBlur = useCallback(() => {
    const provider = providerRef.current;
    if (!provider) {
      return;
    }
    provider.awareness.setLocalStateField('focusedField', null);
  }, []);

  const updateField = useCallback(
    (key: keyof ContractFields, value: number) => {
      yjsFieldsRef.current?.set(key, value);
    },
    [],
  );

  const addTier = useCallback(() => {
    const doc = docRef.current;
    if (!doc) return;

    const yjsTiers = doc.getArray<Tier>('tiers');

    doc.transact(() => {
      // 화면에는 기본 1단계(0~100)가 보이지만 문서에는 아직 없을 수 있다.
      // 이 경우 먼저 기본 1단계를 실체화한 뒤 분할해야 항상 단계가 하나 늘어난다.
      if (yjsTiers.length === 0) {
        yjsTiers.push([{ tier: 1, minPct: 0, maxPct: null, count: 0 }]);
      }

      const last = yjsTiers.get(yjsTiers.length - 1);
      const newMinPct = last.maxPct ?? last.minPct + 1;

      // 직전 마지막 단계의 종료%를 새 경계로 확정하고, 그 위에 새 단계를 쌓는다.
      // 새로 추가되는 단계는 항상 2단계 이상이므로 벌칙 개수 기본값을 1로 둔다.
      // (1단계 기본값 0은 위 실체화/시드 로직에서 그대로 유지된다.)
      yjsTiers.delete(yjsTiers.length - 1, 1);
      yjsTiers.insert(yjsTiers.length, [{ ...last, maxPct: newMinPct }]);
      yjsTiers.push([
        {
          tier: yjsTiers.length + 1,
          minPct: newMinPct,
          maxPct: null,
          count: 1,
        },
      ]);
    });
  }, []);

  const updateTier = useCallback((index: number, updated: Partial<Tier>) => {
    const doc = docRef.current;
    if (!doc) {
      return;
    }

    const yjsTiers = doc.getArray<Tier>('tiers');
    doc.transact(() => {
      // 화면의 기본 1단계가 아직 문서에 없으면 먼저 실체화한다.
      if (yjsTiers.length === 0 && index === 0) {
        yjsTiers.push([{ tier: 1, minPct: 0, maxPct: null, count: 0 }]);
      }
      const current = yjsTiers.get(index);
      if (!current) return;
      yjsTiers.delete(index, 1);
      yjsTiers.insert(index, [{ ...current, ...updated }]);
    });
  }, []);

  // index 단계의 종료%(maxPct)를 설정하고, 이후 모든 단계의 시작/종료%를 연쇄로 재정렬한다.
  const setTierBoundary = useCallback((index: number, maxPct: number) => {
    const doc = docRef.current;
    if (!doc) return;

    const yjsTiers = doc.getArray<Tier>('tiers');
    const list = yjsTiers.toArray();
    if (index < 0 || index >= list.length - 1) return; // 마지막 단계는 100% 고정

    doc.transact(() => {
      const rebuilt = list.map((t) => ({ ...t }));
      rebuilt[index].maxPct = maxPct;

      // index 다음부터 끝까지 minPct는 이전 단계의 maxPct를 이어받고,
      // maxPct가 minPct 이하로 역전되면 minPct+1로 밀어 올린다. 마지막은 100%(null).
      for (let j = index + 1; j < rebuilt.length; j++) {
        rebuilt[j].minPct = rebuilt[j - 1].maxPct ?? 0;
        if (j === rebuilt.length - 1) {
          rebuilt[j].maxPct = null;
        } else if (
          rebuilt[j].maxPct === null ||
          (rebuilt[j].maxPct as number) <= rebuilt[j].minPct
        ) {
          rebuilt[j].maxPct = Math.min(99, rebuilt[j].minPct + 1);
        }
      }

      yjsTiers.delete(0, yjsTiers.length);
      yjsTiers.insert(0, rebuilt);
    });
  }, []);

  const removeTier = useCallback((index: number) => {
    if (index === 0) return;
    const doc = docRef.current;
    if (!doc) return;

    const yjsTiers = doc.getArray<Tier>('tiers');

    doc.transact(() => {
      yjsTiers.delete(index, 1);

      const remaining = yjsTiers.toArray();
      const rebuilt = remaining.map((t, i) => ({
        ...t,
        tier: i + 1,
        minPct: i === 0 ? 0 : (remaining[i - 1].maxPct ?? 0),
      }));

      yjsTiers.delete(0, yjsTiers.length);
      yjsTiers.insert(0, rebuilt);
    });
  }, []);

  const addPenalty = useCallback((content: string) => {
    yjsPenaltiesRef.current?.push([{ id: uuid(), content }]);
  }, []);

  const updatePenalty = useCallback((index: number, content: string) => {
    const doc = docRef.current;
    if (!doc) {
      return;
    }

    const yjsPenalties = doc.getArray<Penalty>('penalties');
    const current = yjsPenalties.get(index);

    doc.transact(() => {
      yjsPenalties.delete(index, 1);
      yjsPenalties.insert(index, [{ ...current, content }]);
    });
  }, []);

  const removePenalty = useCallback((index: number) => {
    const doc = docRef.current;
    if (!doc) {
      return;
    }

    doc.transact(() => {
      doc.getArray<Penalty>('penalties').delete(index, 1);
    });
  }, []);

  const applyAll = useCallback((data: ApplyData) => {
    const doc = docRef.current;
    if (!doc) return;

    doc.transact(() => {
      if (data.fields) {
        const yjsFields = doc.getMap<number>('fields');
        yjsFields.set('focusMin', data.fields.focusMin);
        yjsFields.set('breakMin', data.fields.breakMin);
        yjsFields.set('rounds', data.fields.rounds);
      }

      if (data.tiers) {
        const yjsTiers = doc.getArray<Tier>('tiers');
        if (yjsTiers.length > 0) {
          yjsTiers.delete(0, yjsTiers.length);
        }
        if (data.tiers.length > 0) {
          yjsTiers.insert(0, data.tiers);
        }
      }
      if (data.penalties) {
        const yjsPenalties = doc.getArray<Penalty>('penalties');
        const mode = data.penaltyMode ?? 'replace';

        if (mode === 'replace') {
          if (yjsPenalties.length > 0) {
            yjsPenalties.delete(0, yjsPenalties.length);
          }
          if (data.penalties.length > 0) {
            yjsPenalties.insert(0, data.penalties);
          }
        } else {
          const newPenalties = data.penalties.map((p) => ({
            ...p,
            id: crypto.randomUUID(),
          }));

          if (newPenalties.length > 0) {
            yjsPenalties.push(newPenalties);
          }
        }
      }
    });
  }, []);

  return {
    fields,
    fieldOwners,
    tiers,
    penalties,
    isConnected,
    updateField,
    addTier,
    updateTier,
    setTierBoundary,
    removeTier,
    addPenalty,
    updatePenalty,
    removePenalty,
    handleFocus,
    handleBlur,
    applyAll,
  };
}
