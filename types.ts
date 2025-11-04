export type UserRole = 'host' | 'speaker' | 'listener';

export interface User {
  id: string;
  name: string;
  username?: string;
  displayName?: string;
  avatarUrl: string;
  role?: UserRole;
  isSpeaking?: boolean;
  isMuted?: boolean;
  handRaised?: boolean;
}

export interface Transcript {
  id: string;
  userId: string;
  name: string;
  text: string;
  timestamp: number;
}

export interface Room {
  id:string;
  title: string;
  host: User;
  speakers: User[];
  listeners: User[];
  tags: string[];
  transcripts: Transcript[];
  isLocked?: boolean;
  invitedUsernames?: string[];
}
