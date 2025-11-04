import type { Room, User, Transcript } from '../types';

type Subscriber = (rooms: Room[]) => void;
type RoomSubscriber = (room: Room | null) => void;

const DEV_WS_URL = 'ws://localhost:3001';

class RealtimeService {
  private ws: WebSocket | null = null;
  private subscribers: Set<Subscriber> = new Set();
  private roomSubscribers: Map<string, Set<RoomSubscriber>> = new Map();
  private rooms: Room[] = [];
  private isConnecting = false;
  private connectionPromise: Promise<void> | null = null;
  private websocketUrl: string | null;
  private realtimeDisabled = false;

  constructor() {
    this.websocketUrl = this.resolveWebSocketUrl();

    if (!this.websocketUrl) {
      this.realtimeDisabled = true;
      console.warn(
        'Realtime WebSocket disabled. Set VITE_REALTIME_URL to enable realtime features in secure environments.',
      );
      return;
    }

    this.connect();
  }

  private resolveWebSocketUrl(): string | null {
    const envUrl = (import.meta.env.VITE_REALTIME_URL as string | undefined)?.trim();
    if (envUrl) {
      return envUrl;
    }

    if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
      return null;
    }

    return DEV_WS_URL;
  }

  private connect() {
    if (this.ws || this.isConnecting || this.realtimeDisabled) return;
    if (!this.websocketUrl) {
      this.realtimeDisabled = true;
      return;
    }

    this.isConnecting = true;
    this.connectionPromise = new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.websocketUrl as string);
      } catch (error) {
        this.ws = null;
        this.isConnecting = false;
        this.realtimeDisabled = true;
        console.error('Failed to initialise WebSocket connection:', error);
        reject(error instanceof Error ? error : new Error('WebSocket initialisation failed.'));
        return;
      }

      this.ws.onopen = () => {
        console.log('WebSocket connected to backend.');
        this.isConnecting = false;
        this.sendMessage('GET_INITIAL_ROOMS', {});
        resolve();
      };

      this.ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        const { type, payload } = message;

        switch (type) {
          case 'ALL_ROOMS_UPDATE':
            this.rooms = payload;
            this.notifySubscribers();
            break;
          case 'ROOM_STATE_UPDATE': {
            // Update the specific room in our local cache
            const roomIndex = this.rooms.findIndex((r) => r.id === payload.id);
            if (roomIndex > -1) {
              this.rooms[roomIndex] = payload;
            } else {
              this.rooms.push(payload);
            }
            this.notifySubscribers(); // Notify general room list listeners
            this.notifyRoomSubscribers(payload.id, payload); // Notify specific room listeners
            break;
          }
          case 'ROOM_CREATED':
            // The server confirms room creation and sends back the full room object
            // The 'ALL_ROOMS_UPDATE' will handle adding it, but we need to resolve the promise for createRoom
            break;
          case 'ROOM_JOIN_DENIED':
            console.warn('Join request denied:', payload?.reason ?? 'unknown reason');
            break;
          case 'LOCK_ROOM_DENIED':
            console.warn('Lock toggle denied:', payload?.reason ?? 'unknown reason');
            break;
        }
      };

      this.ws.onclose = (event: CloseEvent) => {
        this.ws = null;
        this.isConnecting = false;
        let reason = `WebSocket disconnected. Code: ${event.code}.`;
        if (event.code === 1006) {
          reason +=
            ' This is an abnormal closure. Is the backend server running? (Try `npm run dev` in the `backend` directory). Reconnecting...';
        }
        console.warn(reason);
        if (!this.realtimeDisabled) {
          setTimeout(() => this.connect(), 3000); // Reconnect after 3 seconds
        }
        reject(new Error(reason));
      };

      this.ws.onerror = () => {
        // The onerror event doesn't provide specific details;
        // the onclose event that follows is more informative.
        console.error('A WebSocket error occurred. See the disconnection message for details.');
        // Don't reject here; onclose will handle it.
      };
    });
  }

  private async ensureConnected() {
    if (this.realtimeDisabled) {
      return;
    }

    if (!this.ws && !this.isConnecting) {
      this.connect();
    }

    if (this.connectionPromise) {
      try {
        await this.connectionPromise;
      } catch (error) {
        console.error('Realtime connection failed:', error);
      }
    }
  }

  private sendMessage(type: string, payload: object) {
    if (this.realtimeDisabled) {
      return;
    }

    this.ensureConnected()
      .then(() => {
        if (this.ws?.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ type, payload }));
        }
      })
      .catch(() => {
        // ensureConnected already logged the error.
      });
  }

  // For RoomsOverviewPage
  subscribe(callback: Subscriber) {
    this.subscribers.add(callback);
    // Immediately give them the current state
    callback(this.getRooms());
  }

  unsubscribe(callback: Subscriber) {
    this.subscribers.delete(callback);
  }

  // For VoiceRoomPage
  subscribeToRoom(roomId: string, callback: RoomSubscriber) {
    if (!this.roomSubscribers.has(roomId)) {
      this.roomSubscribers.set(roomId, new Set());
    }
    this.roomSubscribers.get(roomId)?.add(callback);
    // Immediately give them current state if we have it
    const room = this.getRoomById(roomId);
    if (room) callback(room);
  }

  unsubscribeFromRoom(roomId: string, callback: RoomSubscriber) {
    this.roomSubscribers.get(roomId)?.delete(callback);
  }

  private notifySubscribers() {
    for (const callback of this.subscribers) {
      callback(this.getRooms());
    }
  }

  private notifyRoomSubscribers(roomId: string, room: Room | null) {
    const subs = this.roomSubscribers.get(roomId);
    if (subs) {
      for (const callback of subs) {
        callback(room);
      }
    }
  }

  getRooms(): Room[] {
    return JSON.parse(JSON.stringify(this.rooms));
  }

  getRoomById(roomId: string): Room | null {
    const room = this.rooms.find((r) => r.id === roomId);
    return room ? JSON.parse(JSON.stringify(room)) : null;
  }

  async createRoom({
    title,
    tags,
    host,
    isLocked,
    invitedUsernames,
  }: {
    title: string;
    tags: string[];
    host: User;
    isLocked: boolean;
    invitedUsernames: string[];
  }): Promise<Room> {
    if (this.realtimeDisabled) {
      return Promise.reject(
        new Error('Realtime backend is not configured. Set VITE_REALTIME_URL to enable room creation.'),
      );
    }

    await this.ensureConnected();
    return new Promise((resolve) => {
      const listener = (event: MessageEvent) => {
        const message = JSON.parse(event.data);
        if (message.type === 'ROOM_CREATED' && message.payload.title === title) {
          this.ws?.removeEventListener('message', listener);
          resolve(message.payload);
        }
      };
      this.ws?.addEventListener('message', listener);
      this.sendMessage('CREATE_ROOM', { title, tags, user: host, isLocked, invitedUsernames });
    });
  }

  addTranscript(roomId: string, userId: string, name: string, text: string) {
    this.sendMessage('ADD_TRANSCRIPT', { roomId, userId, name, text });
  }

  joinRoom(roomId: string, user: User) {
    this.sendMessage('JOIN_ROOM', { roomId, user });
  }

  leaveRoom(roomId: string, userId: string) {
    this.sendMessage('LEAVE_ROOM', { roomId, userId });
  }

  promoteToSpeaker(roomId: string, userId: string) {
    this.sendMessage('PROMOTE_TO_SPEAKER', { roomId, userId });
  }

  demoteToListener(roomId: string, userId: string) {
    this.sendMessage('DEMOTE_TO_LISTENER', { roomId, userId });
  }

  toggleLockRoom(roomId: string, userId: string) {
    this.sendMessage('TOGGLE_LOCK_ROOM', { roomId, userId });
  }

  toggleHandRaise(roomId: string, userId: string, isRaised: boolean) {
    this.sendMessage('TOGGLE_HAND_RAISE', { roomId, userId, isRaised });
  }
}

export const realtimeService = new RealtimeService();
