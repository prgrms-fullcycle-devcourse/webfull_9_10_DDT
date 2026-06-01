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

export function useYjsContract(
  roomCode: string,
  enabled: boolean,
  isHost: boolean,
): UseContractYjsReturn {
  const docRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<typeof WebsocketProvider | null>(null);

  const [isConnected, setIsConnected] = useState(false);
  const [fields, setFields] = useState<ContractFields>({
    focusMin: 0,
    breakMin: 0,
    rounds: 0,
  });
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [penalties, setPenalties] = useState<Penalty[]>([]);
  const [fieldOwners, setFieldOwners] = useState<Record<string, FocusedField>>(
    {},
  );

  useEffect(() => {
    if (!roomCode || !enabled) {
      return;
    }

    const doc = new Y.Doc();

    docRef.current = doc;

    const yjsFields = doc.getMap<number>('fields');
    const yjsTiers = doc.getArray<Tier>('tiers');
    const yjsPenalties = doc.getArray<Penalty>('penalties');

    const serverUrl = 'ws://localhost:8080/yjs?roomCode=' + roomCode;

    const provider = new WebsocketProvider(serverUrl, '', doc);
    const awareness = provider.awareness;

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

    provider.on('sync', (isSynced: boolean) => {
      if (!isSynced) return;

      const yjsTiers = doc.getArray<Tier>('tiers');
      if (yjsTiers.length === 0 && isHost) {
        doc.transact(() => {
          yjsTiers.push([
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

    yjsFields.observe(() => {
      setFields({
        focusMin: yjsFields.get('focusMin') ?? 0,
        breakMin: yjsFields.get('breakMin') ?? 0,
        rounds: yjsFields.get('rounds') ?? 0,
      });
    });

    yjsTiers.observe(() => {
      setTiers(yjsTiers.toArray());
    });

    yjsPenalties.observe(() => {
      setPenalties(yjsPenalties.toArray());
    });

    return () => {
      awareness.off('change', handleAwarenessChange);
      provider.destroy();
      doc.destroy();
      docRef.current = null;
      providerRef.current = null;
      setIsConnected(false);
    };
  }, [roomCode, enabled, isHost]);

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
      const doc = docRef.current;
      if (!doc) {
        return;
      }

      doc.transact(() => {
        doc.getMap<number>('fields').set(key, value);
      });
    },
    [],
  );

  const addTier = useCallback(() => {
    const doc = docRef.current;
    if (!doc) return;

    const yjsTiers = doc.getArray<Tier>('tiers');
    const isFirst = yjsTiers.length === 0;
    const last = isFirst ? null : yjsTiers.get(yjsTiers.length - 1);

    const newMinPct = isFirst ? 0 : (last!.maxPct ?? last!.minPct + 1);

    doc.transact(() => {
      if (last) {
        yjsTiers.delete(yjsTiers.length - 1, 1);
        yjsTiers.insert(yjsTiers.length, [
          {
            ...last,
            maxPct: newMinPct,
          },
        ]);
      }
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
    const current = yjsTiers.get(index);
    doc.transact(() => {
      yjsTiers.delete(index, 1);
      yjsTiers.insert(index, [{ ...current, ...updated }]);
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
    const doc = docRef.current;
    if (!doc) {
      return;
    }

    doc.transact(() => {
      doc
        .getArray<Penalty>('penalties')
        .push([{ id: crypto.randomUUID(), content }]);
    });
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
        yjsFields.set('focusMin', data.fields?.focusMin);
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
    removeTier,
    addPenalty,
    updatePenalty,
    removePenalty,
    handleFocus,
    handleBlur,
    applyAll,
  };
}
