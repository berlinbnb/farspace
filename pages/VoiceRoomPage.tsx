import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { Room, User, Transcript } from '../types';
import Avatar from '../components/Avatar';
import MicOnIcon from '../components/icons/MicOnIcon';
import MicOffIcon from '../components/icons/MicOffIcon';
import HandIcon from '../components/icons/HandIcon';
import LeaveIcon from '../components/icons/LeaveIcon';
import SpeakerIcon from '../components/icons/SpeakerIcon';
import UsersIcon from '../components/icons/UsersIcon';
import LockIcon from '../components/icons/LockIcon';
import ArrowUpIcon from '../components/icons/ArrowUpIcon';
import ArrowDownIcon from '../components/icons/ArrowDownIcon';
import TranscriptView from '../components/TranscriptView';
import { realtimeService } from '../services/realtimeService';
import HandRaisedIcon from '../components/icons/HandRaisedIcon';
import { audioService } from '../services/audioService';
import { moderationTools } from '../services/geminiTools';

interface VoiceRoomPageProps {
  roomId: string;
  onLeave: () => void;
  currentUser: User;
}

const CircularLayout: React.FC<{ speakers: User[], activeSpeakerId: string | null }> = ({ speakers, activeSpeakerId }) => {
    const radius = speakers.length > 5 ? 140 : 120;
    const numSpeakers = speakers.length;

    return (
        <div className="relative w-full h-80 flex items-center justify-center scale-90 md:scale-100">
            {speakers.map((speaker, index) => {
                const angle = (index / numSpeakers) * 2 * Math.PI - Math.PI / 2;
                const x = radius * Math.cos(angle);
                const y = radius * Math.sin(angle);
                const isHost = speaker.role === 'host';
                
                return (
                    <div
                        key={speaker.id}
                        className="absolute transition-transform duration-500"
                        style={{ transform: `translate(${x}px, ${y}px)` }}
                    >
                        <Avatar user={speaker} size={isHost ? 'lg' : 'md'} isHost={isHost} isSpeaking={speaker.id === activeSpeakerId} />
                    </div>
                );
            })}
             {speakers.length === 0 && <p className="text-gray-500">The room is quiet...</p>}
        </div>
    );
};


const VoiceRoomPage: React.FC<VoiceRoomPageProps> = ({ roomId, onLeave, currentUser }) => {
  const [roomState, setRoomState] = useState<Room | null>(realtimeService.getRoomById(roomId));
  const [isMuted, setIsMuted] = useState(true);
  const [activeSpeakerId, setActiveSpeakerId] = useState<string | null>(null);
  const [moderationUser, setModerationUser] = useState<User | null>(null);
  const [currentTranscript, setCurrentTranscript] = useState('');

  const popoverRef = useRef<HTMLDivElement>(null);
  
  const isCurrentUserHost = roomState?.host.id === currentUser.id;

  const systemInstruction = useMemo(() => {
    if (!isCurrentUserHost || !roomState) return undefined;
    
    const formatUserLabel = (u: User) => u.username ? `@${u.username}` : (u.displayName || u.name);
    const speakers = roomState.speakers.map(formatUserLabel).join(', ');
    const listeners = roomState.listeners.map(formatUserLabel).join(', ');
    
    return `You are FarSpace, a voice-activated moderator for this audio room. The host will give you commands. Your available tools are promoteToSpeaker and demoteToListener.
Here is the current list of participants:
- Speakers: ${speakers || 'none'}
- Listeners: ${listeners || 'none'}
When a command is given, like 'make farcaster_user_3 a speaker', find their exact username from the lists and call the appropriate function. Only respond with function calls. Do not add conversational filler.`;
  }, [isCurrentUserHost, roomState]);

  useEffect(() => {
    const handleRoomUpdate = (updatedRoom: Room | null) => {
      if (updatedRoom) {
        setRoomState(updatedRoom);
      } else {
        // Room was likely deleted (e.g., host left)
        onLeave();
      }
    };
    realtimeService.subscribeToRoom(roomId, handleRoomUpdate);
    
    audioService.setSpeakerCallback(setActiveSpeakerId);
    audioService.setTranscriptionCallback(({ text, isFinal }) => {
        if (isFinal) {
            if(text.trim()) {
                const speakerName = currentUser.displayName || currentUser.name;
                realtimeService.addTranscript(roomId, currentUser.id, speakerName, text);
            }
            setCurrentTranscript('');
        } else {
            setCurrentTranscript(text);
        }
    });
    audioService.setFunctionCallCallback(({name, args, id}) => {
        const normaliseIdentifier = (value: string) => {
            if (!value) return value;
            return value.startsWith('@') ? value.slice(1) : value;
        };
        const findUserByIdentifier = (collection: User[] | undefined, identifier: string | undefined) => {
            if (!identifier) return undefined;
            const cleaned = normaliseIdentifier(identifier);
            return collection?.find(u => 
                u.id === identifier ||
                u.id === cleaned ||
                (u.username && u.username === cleaned) ||
                u.name === identifier ||
                u.displayName === identifier
            );
        };

        let userToModify: User | undefined;
        let result = { status: "failed", reason: "User not found or action is invalid." };

        switch (name) {
            case 'promoteToSpeaker':
                userToModify = findUserByIdentifier(roomState?.listeners, args.username);
                if (userToModify) {
                    realtimeService.promoteToSpeaker(roomId, userToModify.id);
                    result = { status: "success", reason: "" };
                }
                break;
            case 'demoteToListener':
                userToModify = findUserByIdentifier(roomState?.speakers, args.username);
                // Also ensure the host isn't being demoted
                if (userToModify && userToModify.id !== roomState?.host.id) {
                    realtimeService.demoteToListener(roomId, userToModify.id);
                    result = { status: "success", reason: "" };
                } else if (userToModify) {
                    result.reason = "Cannot demote the host.";
                }
                break;
        }

        audioService.sendToolResponse({
            functionResponses: {
                id,
                name,
                response: { result: JSON.stringify(result) },
            }
        });
    });

    return () => {
        realtimeService.unsubscribeFromRoom(roomId, handleRoomUpdate);
        audioService.stopStreaming();
    }
  }, [roomId, onLeave, currentUser.id, currentUser.name, currentUser.displayName, roomState]);

  // Handle Audio Streaming based on mute state
  useEffect(() => {
      if (!isMuted) {
          const streamOptions = isCurrentUserHost 
            ? { tools: moderationTools, systemInstruction: systemInstruction }
            : {};
          audioService.startStreaming(currentUser.id, streamOptions);
      } else {
          audioService.stopStreaming();
          setCurrentTranscript(''); // Clear transcript when muting
      }
  }, [isMuted, currentUser.id, isCurrentUserHost, systemInstruction]);

  const me = roomState?.speakers.find(u => u.id === currentUser.id) || roomState?.listeners.find(u => u.id === currentUser.id);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      if (e.key.toLowerCase() === 'm' && me?.role !== 'listener') {
         setIsMuted(prev => !prev);
      }
      if (e.key.toLowerCase() === 'h') {
        if(me) realtimeService.toggleHandRaise(roomId, currentUser.id, !me.handRaised);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [me, roomId, currentUser.id]);

  // Close moderation popover on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
            setModerationUser(null);
        }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!roomState) {
    return (
        <div className="h-screen flex items-center justify-center bg-dark-bg">
            <p className="text-xl text-gray-400">Loading room...</p>
        </div>
    );
  }
  
  const isCurrentUserSpeaker = roomState.speakers.some(s => s.id === currentUser.id);

  const handleModerationClick = (user: User) => {
    if (isCurrentUserHost && user.id !== currentUser.id) {
        setModerationUser(user);
    }
  };
  
  const ParticipantList: React.FC<{ users: User[], title: string }> = ({ users, title }) => (
    <div>
      <h3 className="text-gray-400 font-semibold mb-3 px-4">{title} ({users.length})</h3>
      <ul className="space-y-1">
        {users.map(user => (
          <li
            key={user.id}
            className={`relative flex items-center space-x-3 px-4 py-2 rounded-custom border transition-colors duration-300 group ${user.id === activeSpeakerId ? 'speaking-row border-secondary-accent/60' : 'border-transparent hover:bg-glass-bg'}`}
          >
            <button onClick={() => handleModerationClick(user)} className="flex items-center space-x-3 w-full text-left" disabled={!isCurrentUserHost || user.id === currentUser.id}>
                <Avatar user={user} size="sm" isSpeaking={user.id === activeSpeakerId} />
                <div className="flex-1 flex flex-col">
                  <div className="flex items-center space-x-2">
                    <span className="text-gray-200 truncate">{user.displayName || user.name}</span>
                    {user.role === 'host' && <span className="text-xs font-bold text-primary-accent">HOST</span>}
                  </div>
                  {user.username && <span className="text-xs text-gray-500 truncate">@{user.username}</span>}
                </div>
                {user.handRaised && <HandRaisedIcon className="w-5 h-5 text-secondary-accent flex-shrink-0" />}
            </button>
            {moderationUser?.id === user.id && (
                <div ref={popoverRef} className="absolute right-4 top-1/2 -translate-y-1/2 bg-dark-bg border border-glass-border rounded-custom p-2 flex items-center space-x-2 z-20 shadow-lg">
                   {user.role === 'listener' && (
                       <button onClick={() => {realtimeService.promoteToSpeaker(roomId, user.id); setModerationUser(null);}} className="p-2 rounded-full hover:bg-secondary-accent/20 text-secondary-accent" title="Promote to speaker"><ArrowUpIcon /></button>
                   )}
                   {user.role === 'speaker' && (
                       <button onClick={() => {realtimeService.demoteToListener(roomId, user.id); setModerationUser(null);}} className="p-2 rounded-full hover:bg-white/20" title="Move to listeners"><ArrowDownIcon /></button>
                   )}
                   <button className="p-2 rounded-full hover:bg-red-500/20 text-red-400" title="Mute user"><MicOffIcon className="w-5 h-5"/></button>
                </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <div className="h-screen flex flex-col md:flex-row bg-dark-bg">
      <main className="flex-1 flex flex-col p-4 md:p-8">
        <header className="mb-4">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-2xl font-semibold">{roomState.title}</h1>
                    <div className="flex space-x-2 mt-1">
                        {roomState.tags.map(tag => (
                        <span key={tag} className="bg-glass-bg text-secondary-accent text-xs font-semibold px-2 py-1 rounded-full">{tag}</span>
                        ))}
                    </div>
                </div>
                <div className="flex items-center space-x-4 text-sm text-gray-400">
                    <div className="flex items-center space-x-1.5"><SpeakerIcon className="w-4 h-4 text-secondary-accent" /> <span>{roomState.speakers.length}</span></div>
                    <div className="flex items-center space-x-1.5"><UsersIcon className="w-4 h-4" /> <span>{roomState.listeners.length}</span></div>
                    <div className="flex items-center space-x-2">
                        {roomState.isLocked && <span className="text-xs uppercase tracking-wide text-primary-accent">Locked</span>}
                        {isCurrentUserHost && (
                            <button 
                                onClick={() => realtimeService.toggleLockRoom(roomId, currentUser.id)} 
                                className={`p-2 rounded-full ${roomState.isLocked ? 'bg-primary-accent/30 text-primary-accent' : 'hover:bg-white/10'}`} 
                                title={roomState.isLocked ? 'Unlock Room' : 'Lock Room'}
                                aria-pressed={roomState.isLocked}
                            >
                                <LockIcon className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </header>
        
        <div className="flex-1 flex flex-col items-center justify-center overflow-hidden">
           <CircularLayout speakers={roomState.speakers} activeSpeakerId={activeSpeakerId} />
           <TranscriptView transcripts={roomState.transcripts} currentTranscript={currentTranscript} />
        </div>

        <footer className="w-full max-w-md mx-auto py-4">
          <div className="bg-glass-bg border border-glass-border rounded-custom p-2 md:p-3 flex justify-around md:justify-center items-center md:space-x-4 backdrop-blur-md">
            <button 
                onClick={() => {
                   if(me) realtimeService.toggleHandRaise(roomId, currentUser.id, !me.handRaised);
                }}
                className={`p-3 md:p-4 rounded-full transition-colors duration-300 ${me?.handRaised ? 'bg-secondary-accent/80 text-dark-bg' : 'bg-white/20 hover:bg-white/30'}`}
                aria-label={me?.handRaised ? 'Lower Hand' : 'Raise Hand'}
            >
              <HandIcon />
            </button>
             <button 
                onClick={() => setIsMuted(!isMuted)}
                className={`p-4 w-16 h-16 md:p-4 md:w-auto md:h-auto rounded-full transition-colors duration-300 ${isMuted ? 'bg-red-500/80 hover:bg-red-500' : 'bg-primary-accent/80 hover:bg-primary-accent'} disabled:bg-gray-600 disabled:cursor-not-allowed`}
                aria-label={isMuted ? 'Unmute' : 'Mute'}
                disabled={!isCurrentUserSpeaker}
                >
              {isMuted ? <MicOffIcon /> : <MicOnIcon />}
            </button>
            <button onClick={onLeave} className="p-3 md:p-4 rounded-full bg-white/20 hover:bg-white/30" aria-label="Leave Room">
              <LeaveIcon />
            </button>
          </div>
        </footer>
      </main>

      <aside className="w-full md:w-80 bg-black/20 border-l border-glass-border p-4 h-full overflow-y-auto">
        <h2 className="text-xl font-semibold mb-6 px-4">Participants ({roomState.speakers.length + roomState.listeners.length})</h2>
        <div className="space-y-6">
          <ParticipantList users={roomState.speakers} title="Speakers" />
          <ParticipantList users={roomState.listeners} title="Listeners" />
        </div>
      </aside>
    </div>
  );
};

export default VoiceRoomPage;
