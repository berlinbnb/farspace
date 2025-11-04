import React from 'react';
import type { User } from '../types';

interface AvatarProps {
  user: User;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  isHost?: boolean;
  isSpeaking?: boolean;
}

const sizeClasses = {
  sm: 'w-10 h-10',
  md: 'w-16 h-16',
  lg: 'w-24 h-24',
  xl: 'w-32 h-32',
};

const Avatar: React.FC<AvatarProps> = ({ user, size = 'md', isHost = false, isSpeaking = false }) => {
  const containerSize = sizeClasses[size];
  const displayName = user.displayName || user.name;
  const usernameLabel = user.username ? `@${user.username}` : undefined;

  return (
    <div className={`relative flex flex-col items-center gap-2 ${containerSize} ${isSpeaking ? 'speaking-glow' : ''}`} title={usernameLabel || displayName}>
      <div className={`relative rounded-full transition-all duration-300 ${containerSize} 
        ${isHost ? 'p-1 bg-gradient-to-tr from-primary-accent to-secondary-accent' : ''}
        ${isSpeaking ? 'ring-4 ring-secondary-accent ring-opacity-75 avatar-speaking' : ''}`}
      >
        {isHost && <div className="absolute inset-0 rounded-full bg-primary-accent opacity-50 blur-lg"></div>}
        {isSpeaking && <div className="absolute -inset-1 rounded-full bg-secondary-accent opacity-50 blur-lg animate-pulse-glow"></div>}
        <img
          src={user.avatarUrl}
          alt={displayName}
          className="w-full h-full rounded-full object-cover border-2 border-dark-bg relative z-10"
        />
      </div>
      {size !== 'sm' && (
        <div className="flex flex-col items-center">
          <p className="text-sm text-gray-300 truncate font-semibold max-w-[120px]">{displayName}</p>
          {user.username && <p className="text-xs text-gray-500 truncate max-w-[120px]">@{user.username}</p>}
        </div>
      )}
    </div>
  );
};

export default Avatar;
