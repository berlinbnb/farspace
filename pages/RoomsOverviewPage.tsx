import React, { useState } from 'react';
import type { Room, User } from '../types';
import RoomCard from '../components/RoomCard';
import Button from '../components/Button';
import JoinBanner from '../components/JoinBanner';
import LogoIcon from '../components/icons/LogoIcon';

interface RoomsOverviewPageProps {
  rooms: Room[];
  onJoinRoom: (room: Room) => void;
  onCreateRoom: () => void;
  currentUser: User;
}

const RoomsOverviewPage: React.FC<RoomsOverviewPageProps> = ({ rooms, onJoinRoom, onCreateRoom, currentUser }) => {
  const [showBanner, setShowBanner] = useState(true);
  const normalizeUsername = (value?: string) => value?.toLowerCase() ?? '';
  const currentUsername = normalizeUsername(currentUser.username);

  const canJoinRoom = (room: Room) => {
    if (!room.isLocked) return true;
    if (room.host.id === currentUser.id) return true;
    const invited = room.invitedUsernames?.map(name => name.toLowerCase()) ?? [];
    return currentUsername ? invited.includes(currentUsername) : false;
  };

  const featuredRoom = rooms[0];
  const canJoinFeaturedRoom = featuredRoom ? canJoinRoom(featuredRoom) : false;
  const isFeaturedInvited = featuredRoom ? (featuredRoom.isLocked && canJoinFeaturedRoom && featuredRoom.host.id !== currentUser.id) : false;

  return (
    <div className="min-h-screen container mx-auto px-4 py-8">
      {showBanner && featuredRoom && (
        <JoinBanner 
          room={featuredRoom} 
          canJoin={canJoinFeaturedRoom}
          isInvited={isFeaturedInvited}
          onJoin={() => {
            setShowBanner(false);
            onJoinRoom(featuredRoom)
          }} 
          onClose={() => setShowBanner(false)} 
        />
      )}
      <header className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
            <LogoIcon className="w-40 h-auto" />
        </div>
        <Button onClick={onCreateRoom} variant="primary">
          Create Room
        </Button>
      </header>
      {rooms.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {rooms.map(room => {
            const canJoin = canJoinRoom(room);
            const invited = room.isLocked && canJoin && room.host.id !== currentUser.id;
            return (
              <RoomCard 
                key={room.id} 
                room={room} 
                onJoin={onJoinRoom} 
                canJoin={canJoin}
                isInvited={invited}
              />
            );
          })}
        </div>
      ) : (
        <div className="text-center py-20">
          <p className="text-gray-400 text-lg">No active rooms right now.</p>
          <p className="text-gray-500 mt-2">Why not start one?</p>
        </div>
      )}
    </div>
  );
};

export default RoomsOverviewPage;
