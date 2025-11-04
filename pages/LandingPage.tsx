import React from 'react';
import Button from '../components/Button';
import SpinnerIcon from '../components/icons/SpinnerIcon';
import LogoIcon from '../components/icons/LogoIcon';

interface LandingPageProps {
  onLogin: () => void;
  isLoggingIn: boolean;
  error: string | null;
}

const AvatarWave: React.FC = () => {
    const avatars = [
        { seed: 'avatar1', x: '10%', y: '40%' },
        { seed: 'avatar2', x: '30%', y: '60%' },
        { seed: 'avatar3', x: '50%', y: '30%' },
        { seed: 'avatar4', x: '70%', y: '70%' },
        { seed: 'avatar5', x: '90%', y: '50%' },
    ];

    return (
        <div className="relative w-full h-48 md:h-64 mt-16">
            <svg width="100%" height="100%" viewBox="0 0 1000 200" preserveAspectRatio="none" className="absolute inset-0">
                <path d="M0 100 Q 250 -50, 500 100 T 1000 100" stroke="#9B4DFF" strokeWidth="2" fill="none" strokeDasharray="5" className="opacity-30" />
                <path d="M0 100 Q 250 250, 500 100 T 1000 100" stroke="#66E3FF" strokeWidth="2" fill="none" strokeDasharray="5" className="opacity-30" />
            </svg>
            {avatars.map(avatar => (
                <img 
                    key={avatar.seed}
                    src={`https://picsum.photos/seed/${avatar.seed}/80`}
                    alt="avatar"
                    className="w-12 h-12 md:w-16 md:h-16 rounded-full absolute border-2 border-glass-border object-cover"
                    style={{ top: avatar.y, left: avatar.x, transform: 'translate(-50%, -50%)' }}
                />
            ))}
        </div>
    )
}

const LandingPage: React.FC<LandingPageProps> = ({ onLogin, isLoggingIn, error }) => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center">
      <main className="max-w-3xl mx-auto">
        <LogoIcon className="w-80 h-auto mx-auto mb-12" />
        <p className="mt-4 text-base md:text-lg text-gray-400 max-w-xl mx-auto">
          Jump into live, decentralized audio spaces with the community.
        </p>
        <div className="mt-12 flex flex-col items-center justify-center gap-4">
          <Button 
            onClick={onLogin} 
            variant="gradient" 
            className="text-lg px-8 py-4 flex items-center justify-center min-w-[280px]"
            disabled={isLoggingIn}
          >
            {isLoggingIn ? <SpinnerIcon className="animate-spin w-7 h-7" /> : 'Sign in with Farcaster'}
          </Button>
          {error && (
              <p className="text-red-400 text-sm max-w-sm">
                  Sign-in failed: {error}
              </p>
          )}
        </div>
        <AvatarWave />
      </main>
    </div>
  );
};

export default LandingPage;