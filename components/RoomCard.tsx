
import React from 'react';
import type { Room } from '../types';
import Button from './Button';
import Avatar from './Avatar';
import UsersIcon from './icons/UsersIcon';
import LockIcon from './icons/LockIcon';

interface RoomCardProps {
  room: Room;
  onJoin: (room: Room) => void;
  canJoin: boolean;
  isInvited?: boolean;
}

const RoomCard: React.FC<RoomCardProps> = ({ room, onJoin, canJoin, isInvited = false }) => {
  const totalParticipants = room.speakers.length + room.listeners.length;
  const isLocked = !!room.isLocked;

  return (
    <div className="bg-glass-bg border border-glass-border rounded-custom p-6 backdrop-blur-sm shadow-lg flex flex-col space-y-4 transition-all duration-300 hover:border-primary-accent/50 hover:shadow-glow-primary">
      <div className="flex items-center space-x-4">
        <Avatar user={room.host} size="md" />
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-white truncate">{room.title}</h3>
          <p className="text-sm text-gray-400">
            Hosted by {room.host.displayName || room.host.name}
            {room.host.username && <span className="text-gray-500"> @{room.host.username}</span>}
          </p>
        </div>
        {isLocked && (
          <div className="flex items-center space-x-2 text-xs font-semibold uppercase tracking-wide">
            <span className="flex items-center space-x-1 text-primary-accent">
              <LockIcon className="w-4 h-4" />
              <span>Locked</span>
            </span>
            {isInvited && <span className="text-secondary-accent">Invited</span>}
          </div>
        )}
      </div>
      <div className="flex items-center justify-between pt-4">
        <div className="flex items-center space-x-2 text-secondary-accent">
          <UsersIcon className="w-5 h-5"/>
          <span className="font-semibold">{totalParticipants}</span>
        </div>
        <Button 
          onClick={() => onJoin(room)} 
          className="px-4 py-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed" 
          variant={isLocked && !canJoin ? 'secondary' : 'primary'}
          disabled={!canJoin}
        >
          {isLocked && !canJoin ? 'Locked' : isInvited ? 'Join (Invited)' : 'Join Room'}
        </Button>
      </div>
    </div>
  );
};

export default RoomCard;
