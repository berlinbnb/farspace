import { GoogleGenAI, LiveSession, LiveServerMessage, Modality, Blob, FunctionDeclaration, Tool } from '@google/genai';
import { encode, decode, decodeAudioData } from '../utils/audioUtils';

const INPUT_SAMPLE_RATE = 16000;
const OUTPUT_SAMPLE_RATE = 24000;

type TranscriptionCallback = (update: { text: string, isFinal: boolean }) => void;
type FunctionCallCallback = (call: { name: string; args: any; id: string }) => void;

class AudioService {
  private ai: GoogleGenAI;
  private session: LiveSession | null = null;
  private sessionPromise: Promise<LiveSession> | null = null;
  private inputAudioContext: AudioContext | null = null;
  private outputAudioContext: AudioContext | null = null;
  private microphoneStream: MediaStream | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private onActiveSpeakerChange: ((speakerId: string | null) => void) | null = null;
  private onTranscriptionUpdate: TranscriptionCallback | null = null;
  private onFunctionCall: FunctionCallCallback | null = null;
  private currentInputTranscription = '';

  constructor() {
    if (!process.env.API_KEY) {
      throw new Error("API_KEY environment variable not set");
    }
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }
  
  public setSpeakerCallback(callback: (speakerId: string | null) => void) {
      this.onActiveSpeakerChange = callback;
  }
  
  public setTranscriptionCallback(callback: TranscriptionCallback) {
      this.onTranscriptionUpdate = callback;
  }

  public setFunctionCallCallback(callback: FunctionCallCallback) {
      this.onFunctionCall = callback;
  }

  public async startStreaming(
      userId: string, 
      options: { tools?: Tool[], systemInstruction?: string } = {}
  ): Promise<void> {
    if (this.session) return;

    try {
      this.inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: INPUT_SAMPLE_RATE });
      this.outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: OUTPUT_SAMPLE_RATE });

      this.microphoneStream = await navigator.mediaDevices.getUserMedia({ audio: true });

      this.sessionPromise = this.ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
          },
          tools: options.tools,
          systemInstruction: options.systemInstruction,
        },
        callbacks: {
          onopen: () => this.handleSessionOpen(),
          onmessage: (message: LiveServerMessage) => this.handleSessionMessage(message, userId),
          onerror: (e: ErrorEvent) => console.error('Session error:', e),
          onclose: (e: CloseEvent) => console.log('Session closed'),
        },
      });

      this.session = await this.sessionPromise;
    } catch (error) {
      console.error("Failed to start audio streaming:", error);
      this.stopStreaming();
    }
  }
  
  public sendToolResponse(response: { functionResponses: { id: string; name: string; response: { result: string; }; }}) {
      this.sessionPromise?.then(session => {
          session.sendToolResponse(response);
      })
  }

  public stopStreaming(): void {
    if (this.scriptProcessor) {
      this.scriptProcessor.disconnect();
      this.scriptProcessor = null;
    }
    if (this.microphoneStream) {
      this.microphoneStream.getTracks().forEach(track => track.stop());
      this.microphoneStream = null;
    }
    if (this.session) {
      this.session.close();
      this.session = null;
      this.sessionPromise = null;
    }
    if (this.onActiveSpeakerChange) {
        this.onActiveSpeakerChange(null);
    }
    this.onTranscriptionUpdate = null;
    this.onFunctionCall = null;
    this.currentInputTranscription = '';
  }

  private handleSessionOpen(): void {
    if (!this.inputAudioContext || !this.microphoneStream || !this.sessionPromise) return;

    const source = this.inputAudioContext.createMediaStreamSource(this.microphoneStream);
    this.scriptProcessor = this.inputAudioContext.createScriptProcessor(4096, 1, 1);

    this.scriptProcessor.onaudioprocess = (event) => {
      const inputData = event.inputBuffer.getChannelData(0);
      const pcmBlob: Blob = {
        data: this.createBlobData(inputData),
        mimeType: `audio/pcm;rate=${INPUT_SAMPLE_RATE}`,
      };
      
      this.sessionPromise?.then(session => {
         session.sendRealtimeInput({ media: pcmBlob });
      });
    };

    source.connect(this.scriptProcessor);
    this.scriptProcessor.connect(this.inputAudioContext.destination);
  }

  private async handleSessionMessage(message: LiveServerMessage, userId: string): Promise<void> {
    // Handle function calls
    if (message.toolCall && this.onFunctionCall) {
        for (const fc of message.toolCall.functionCalls) {
            this.onFunctionCall(fc);
        }
    }
      
    // Handle transcription
    if (message.serverContent?.inputTranscription) {
        const text = message.serverContent.inputTranscription.text;
        this.currentInputTranscription += text;
        if (this.onTranscriptionUpdate) {
            this.onTranscriptionUpdate({ text: this.currentInputTranscription, isFinal: false });
        }
    }
    
    if (message.serverContent?.turnComplete) {
        if (this.onTranscriptionUpdate && this.currentInputTranscription.trim()) {
            this.onTranscriptionUpdate({ text: this.currentInputTranscription, isFinal: true });
        }
        this.currentInputTranscription = '';
    }

    // Handle audio
    const audioData = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
    if (audioData && this.outputAudioContext) {
      if (this.onActiveSpeakerChange) {
        this.onActiveSpeakerChange(userId);
      }
      const decodedBytes = decode(audioData);
      const audioBuffer = await decodeAudioData(decodedBytes, this.outputAudioContext, OUTPUT_SAMPLE_RATE, 1);
      
      const source = this.outputAudioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.outputAudioContext.destination);
      source.start();
      source.onended = () => {
         if (this.onActiveSpeakerChange) {
             this.onActiveSpeakerChange(null);
         }
      };
    }
  }

  private createBlobData(data: Float32Array): string {
    const l = data.length;
    const int16 = new Int16Array(l);
    for (let i = 0; i < l; i++) {
      int16[i] = data[i] * 32768;
    }
    return encode(new Uint8Array(int16.buffer));
  }
}

export const audioService = new AudioService();