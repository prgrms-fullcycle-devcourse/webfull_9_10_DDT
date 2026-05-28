import type { IncomingMessage } from 'node:http';
import type { WebSocket } from 'ws';
import { setupWSConnection } from 'y-websocket/bin/utils';

type SetupWSConnection = (
  ws: WebSocket,
  req: IncomingMessage,
  options?: {
    docName?: string;
    gc?: boolean;
  },
) => void;

export const setupYjsWSConnection =
  setupWSConnection as unknown as SetupWSConnection;
