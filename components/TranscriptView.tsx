import React, { useEffect, useRef } from 'react';
import type { Transcript } from '../types';

interface TranscriptViewProps {
  transcripts: Transcript[];
  currentTranscript: string;
}

const TranscriptView: React.FC<TranscriptViewProps> = ({ transcripts, currentTranscript }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcripts, currentTranscript]);

  return (
    <div className="w-full h-32 md:h-48 max-w-3xl mt-4 bg-black/20 rounded-custom p-4 overflow-y-auto">
      <div ref={scrollRef} className="flex flex-col space-y-2 text-sm">
        {transcripts.map((item) => (
          <div key={item.id}>
            <span className="font-semibold text-primary-accent/80">{item.name}: </span>
            <span className="text-gray-300">{item.text}</span>
          </div>
        ))}
        {currentTranscript && (
           <div>
            <span className="font-semibold text-secondary-accent">Me: </span>
            <span className="text-gray-400 italic">{currentTranscript}</span>
          </div>
        )}
      </div>
      {transcripts.length === 0 && !currentTranscript && (
        <div className="flex items-center justify-center h-full">
            <p className="text-gray-500">Transcripts will appear here when someone speaks...</p>
        </div>
      )}
    </div>
  );
};

export default TranscriptView;