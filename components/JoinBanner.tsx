import React from 'react';
import type { Room } from '../types';
import Button from './Button';
import CloseIcon from './icons/CloseIcon';
import LockIcon from './icons/LockIcon';

interface JoinBannerProps {
  room: Room;
  onJoin: () => void;
  onClose: () => void;
  canJoin: boolean;
  isInvited?: boolean;
}

const JoinBanner: React.FC<JoinBannerProps> = ({ room, onJoin, onClose, canJoin, isInvited = false }) => {
  const isLocked = !!room.isLocked;

  return (
    <div className="bg-glass-bg border-b border-glass-border p-3 flex items-center justify-between sticky top-0 backdrop-blur-md z-10 mb-4 rounded-b-custom animate-fade-in-down">
      <div>
        <p className="text-sm text-gray-400">You've been invited to</p>
        <p className="font-semibold text-white truncate max-w-[200px] sm:max-w-xs">{room.title}</p>
      </div>
      <div className="flex items-center space-x-2">
        <div className="flex items-center space-x-2">
          {isLocked && (
            <div className="flex items-center space-x-1 text-primary-accent text-xs font-semibold uppercase tracking-wide">
              <LockIcon className="w-4 h-4" />
              <span>Locked</span>
            </div>
          )}
          {isLocked && isInvited && (
            <span className="text-xs font-semibold uppercase tracking-wide text-secondary-accent">Invited</span>
          )}
        </div>
        {canJoin && (
          <Button onClick={onJoin} variant="primary" className="px-4 py-2 text-sm">
            {isInvited ? 'Join (Invited)' : 'Join Room'}
          </Button>
        )}
        <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10" aria-label="Close banner">
          <CloseIcon className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

export default JoinBanner;
