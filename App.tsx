import React, { useState, useCallback, useEffect } from 'react';
import LandingPage from './pages/LandingPage';
import RoomsOverviewPage from './pages/RoomsOverviewPage';
import VoiceRoomPage from './pages/VoiceRoomPage';
import type { Room, User } from './types';
import CreateRoomModal from './components/CreateRoomModal';
import { signInWithFarcaster } from './services/farcasterService';
import { realtimeService } from './services/realtimeService';

type Page = 'rooms' | 'room';

// This is a conceptual interface for what a Farcaster client might inject.
// Declaring it globally allows TypeScript to recognize `window.farcaster`.
declare global {
  interface Window {
    farcaster?: {
      signPersonalMessage: (params: { message: string }) => Promise<{ signature: string }>;
      getUser: () => Promise<{ fid: number }>;
    };
  }
}

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<Page>('rooms');
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [isCreateModalOpen, setCreateModalOpen] = useState(false);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(true); // Start true for auto-login
  const [signInError, setSignInError] = useState<string | null>(null);

  useEffect(() => {
    const handleRoomsUpdate = (updatedRooms: Room[]) => {
      setRooms(updatedRooms);
    };
    realtimeService.subscribe(handleRoomsUpdate);
    return () => realtimeService.unsubscribe(handleRoomsUpdate);
  }, []);

  // Attempt to auto-sign-in on load if inside a Farcaster client
  useEffect(() => {
    if (window.farcaster) {
      console.log("Farcaster client detected, attempting auto sign-in...");
      handleSignIn();
    } else {
      console.log("Not in a Farcaster client, showing manual sign-in button.");
      setIsSigningIn(false); // Wait for user to click the button
    }
  }, []); // The empty dependency array ensures this runs only once on mount

  const handleSignIn = useCallback(async () => {
    setIsSigningIn(true);
    setSignInError(null);
    try {
      const userData = await signInWithFarcaster();
      setCurrentUser({ ...userData, role: 'listener' });
      setCurrentPage('rooms');
    } catch (error) {
      console.error("Sign in failed:", error);
      setSignInError((error as Error).message || 'An unknown error occurred.');
    } finally {
      setIsSigningIn(false);
    }
  }, []);

  const handleJoinRoom = useCallback((room: Room) => {
    if (!currentUser) return;
    const normalizedUsername = currentUser.username?.toLowerCase();
    const invitedList = room.invitedUsernames?.map(name => name.toLowerCase()) ?? [];
    const isInvitedByUsername = normalizedUsername ? invitedList.includes(normalizedUsername) : false;
    const isInvitedById = invitedList.includes(currentUser.id.toLowerCase());
    const isInvited = isInvitedByUsername || isInvitedById;
    if (room.isLocked && room.host.id !== currentUser.id && !isInvited) {
      window.alert('Bu oda kilitli ve sadece davetliler katılabilir. Ev sahibinden davet isteyin.');
      return;
    }
    realtimeService.joinRoom(room.id, currentUser);
    setSelectedRoom(room);
    setCurrentPage('room');
  }, [currentUser]);

  const handleLeaveRoom = useCallback(() => {
    if (selectedRoom && currentUser) {
        realtimeService.leaveRoom(selectedRoom.id, currentUser.id);
    }
    setSelectedRoom(null);
    setCurrentPage('rooms');
  }, [selectedRoom, currentUser]);
  
  const openCreateRoomModal = useCallback(() => setCreateModalOpen(true), []);
  const closeCreateRoomModal = useCallback(() => setCreateModalOpen(false), []);

  const handleCreateRoom = useCallback(async (title: string, tags: string[], isLocked: boolean, invitedUsernames: string[]) => {
    if (!currentUser) return;
    // Now returns a promise that resolves with the created room from the server
    const newRoom = await realtimeService.createRoom({ title, tags, host: currentUser, isLocked, invitedUsernames });
    closeCreateRoomModal();
    handleJoinRoom(newRoom);
  }, [closeCreateRoomModal, handleJoinRoom, currentUser]);

  const renderAuthenticatedApp = () => {
    if (!currentUser) return null;

    switch (currentPage) {
      case 'rooms':
        return <RoomsOverviewPage rooms={rooms} onJoinRoom={handleJoinRoom} onCreateRoom={openCreateRoomModal} currentUser={currentUser} />;
      case 'room':
        if (selectedRoom) {
          return <VoiceRoomPage roomId={selectedRoom.id} onLeave={handleLeaveRoom} currentUser={currentUser} />;
        }
        // Fallback to rooms overview if no room is selected
        setCurrentPage('rooms');
        return <RoomsOverviewPage rooms={rooms} onJoinRoom={handleJoinRoom} onCreateRoom={openCreateRoomModal} currentUser={currentUser} />;
      default:
         setCurrentPage('rooms');
         return <RoomsOverviewPage rooms={rooms} onJoinRoom={handleJoinRoom} onCreateRoom={openCreateRoomModal} currentUser={currentUser} />;
    }
  };

  return (
    <div className="min-h-screen bg-dark-bg">
      {!currentUser ? (
        <LandingPage onLogin={handleSignIn} isLoggingIn={isSigningIn} error={signInError} />
      ) : (
        renderAuthenticatedApp()
      )}
      
      {isCreateModalOpen && <CreateRoomModal onClose={closeCreateRoomModal} onCreate={handleCreateRoom} />}
    </div>
  );
};

export default App;
