
import React, { useState } from 'react';
import Button from './Button';

interface CreateRoomModalProps {
  onClose: () => void;
  onCreate: (title: string, tags: string[], isLocked: boolean, invitedUsernames: string[]) => void;
}

const CreateRoomModal: React.FC<CreateRoomModalProps> = ({ onClose, onCreate }) => {
  const [title, setTitle] = useState('');
  const [tags, setTags] = useState('');
  const [isLocked, setIsLocked] = useState(false);
  const [invites, setInvites] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim()) {
      const tagList = tags.split(',').map(tag => tag.trim()).filter(Boolean);
      const invitedUsernames = !isLocked ? [] : Array.from(new Set(
        invites
          .split(',')
          .map(name => name.trim().replace(/^@/, '').toLowerCase())
          .filter(Boolean)
      ));
      onCreate(title.trim(), tagList, isLocked, invitedUsernames);
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div 
        className="bg-dark-bg/80 border border-glass-border rounded-custom p-8 w-full max-w-md shadow-2xl shadow-primary-accent/10"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-2xl font-semibold mb-6 text-center">Create a New Room</h2>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-300 mb-2">
              Room Title
            </label>
            <input
              type="text"
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What's the topic?"
              className="w-full bg-glass-bg border border-glass-border rounded-custom px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-accent"
              required
            />
          </div>
          <div>
            <label htmlFor="tags" className="block text-sm font-medium text-gray-300 mb-2">
              Categories / Tags
            </label>
            <input
              type="text"
              id="tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="Tech, Community, Art (comma-separated)"
              className="w-full bg-glass-bg border border-glass-border rounded-custom px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-accent"
            />
          </div>
          <div className="flex items-center justify-between space-x-4">
            <span className="text-sm text-gray-300">Make room invite-only (locked)</span>
            <button
              type="button"
              onClick={() => setIsLocked(prev => !prev)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300 ${isLocked ? 'bg-primary-accent' : 'bg-white/20'}`}
              aria-pressed={isLocked}
            >
              <span className={`inline-block h-5 w-5 transform rounded-full bg-dark-bg transition-transform duration-300 ${isLocked ? 'translate-x-5' : 'translate-x-1'}`}></span>
            </button>
          </div>
          {isLocked && (
            <div>
              <label htmlFor="invites" className="block text-sm font-medium text-gray-300 mb-2">
                Invited Farcaster usernames (comma-separated)
              </label>
              <input
                type="text"
                id="invites"
                value={invites}
                onChange={(e) => setInvites(e.target.value)}
                placeholder="alice, bob, @carol"
                className="w-full bg-glass-bg border border-glass-border rounded-custom px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-secondary-accent"
              />
              <p className="text-xs text-gray-500 mt-2">Sadece listede olan kullanıcılar kilitliyken odaya katılabilir.</p>
            </div>
          )}
          <div className="pt-2">
            <Button type="submit" variant="gradient" className="w-full text-lg">
              Start Room
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateRoomModal;
