'use client'

import React, { useEffect, useState, useRef } from 'react';
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Search, Mic } from 'lucide-react';

interface Message {
  role: 'user' | 'bot';
  content: string;
  isTyping?: boolean;
  audioUrl?: string;
  imageUrl?: string;
}

const VoiceAssistant: React.FC = () => {
  const [assistantId, setAssistantId] = useState<string | null>(null);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isWaitingForResponse, setIsWaitingForResponse] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    initializeAssistant();
    createThread();
  }, []);

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  const initializeAssistant = async () => {
    try {
      const res = await fetch('/api/initializeAssistant', { method: 'POST' });
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      const text = await res.text();
      console.log('Raw response:', text);
      const data = JSON.parse(text);
      setAssistantId(data.assistantId);
    } catch (error) {
      console.error('Error initializing assistant:', error);
    }
  };  

  const createThread = async () => {
    const res = await fetch('/api/createThread', { method: 'POST' });
    const data = await res.json();
    setThreadId(data.threadId);
  };

  const sendMessage = async (message: string) => {
    if (!message.trim() || isLoading || !threadId || !assistantId) return;

    setIsLoading(true);
    setMessages(prev => [...prev, { role: 'user', content: message }]);

    // Add a temporary bot message to show typing effect
    setMessages(prev => [...prev, { role: 'bot', content: '', isTyping: true }]);
    setIsWaitingForResponse(true);

    try {
      let botResponse;
      let imageUrl: string | undefined;

      if (message.toLowerCase().includes("create image")) {
        try {
          const imageResponse = await fetch('/api/generate-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: message })
          });
          
          if (!imageResponse.ok) {
            throw new Error(`HTTP error! status: ${imageResponse.status}`);
          }
          
          const imageData = await imageResponse.json();
          if (imageData.error) {
            throw new Error(imageData.error);
          }
          
          imageUrl = imageData.imageUrl;
          console.log("Received image URL:", imageUrl);
          botResponse = "Here's the image you requested:";
        } catch (error) {
          console.error('Error generating image:', error);
          botResponse = "Sorry, there was an error generating the image. Please try again.";
        }
      } else {
        // Regular message processing
        const response = await fetch('/api/sendMessage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message, threadId, assistantId })
        });
        const data = await response.json();
        botResponse = data.message;
      }

      // Remove the temporary typing message
      setMessages(prev => prev.slice(0, -1));
      setIsWaitingForResponse(false);

      // Add the actual bot response
      setMessages(prev => [...prev, { role: 'bot', content: '', isTyping: true, imageUrl }]);
      console.log("Message with image URL:", { role: 'bot', content: botResponse, isTyping: true, imageUrl });
      await typeMessageWithAudio(botResponse, imageUrl);
    } catch (error) {
      console.error('Error sending message:', error);
      // Remove the temporary typing message in case of error
      setMessages(prev => prev.slice(0, -1));
      setIsWaitingForResponse(false);
    } finally {
      setIsLoading(false);
    }
  };

  const typeMessageWithAudio = async (message: string, imageUrl: string|undefined) => {
    // First, request the audio
    const ttsResponse = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: message })
    });
    const audioBlob = await ttsResponse.blob();
    const audioUrl = URL.createObjectURL(audioBlob);

    // Set up audio
    if (audioRef.current) {
      audioRef.current.src = audioUrl;
      audioRef.current.load();
    }

    // Get audio duration
    const audioDuration = await getAudioDuration(audioUrl);
    
    // Calculate typing speed based on audio duration
    const typingInterval = 50;

    // Start playing audio
    if (audioRef.current) {
      audioRef.current.play();
    }

    // Then type out the message
    for (let i = 0; i <= message.length; i++) {
      setMessages(prev => [
        ...prev.slice(0, -1),
        { 
          role: 'bot', 
          content: message.slice(0, i), 
          isTyping: i < message.length,
          audioUrl,
          imageUrl
        }
      ]);
      await new Promise(resolve => setTimeout(resolve, typingInterval));
    }
  };

  const getAudioDuration = (url: string): Promise<number> => {
    return new Promise((resolve) => {
      const audio = new Audio(url);
      audio.onloadedmetadata = () => {
        resolve(audio.duration);
      };
    });
  };

  const handleSend = () => {
    sendMessage(inputMessage);
    setInputMessage('');
  };

  const handleImageClick = (imageUrl: string) => {
    setFullscreenImage(imageUrl);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
    }
  };

  const stopRecording = async () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/mp3' });
        const formData = new FormData();
        formData.append('file', audioBlob, 'speech.mp3');

        try {
          const response = await fetch('/api/transcribe', {
            method: 'POST',
            body: formData,
          });

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          const { transcription } = await response.json();
          sendMessage(transcription);
        } catch (error) {
          console.error('Error transcribing audio:', error);
        }
      };
    }
  };

  return (
    <div className="flex flex-col h-screen p-4">
      <ScrollArea className="flex-grow mb-4 border rounded" ref={scrollAreaRef}>
        {messages.map((message, index) => (
          <div key={index} className={`p-2 ${message.role === 'user' ? 'bg-blue-100' : 'bg-green-100'}`}>
            <strong>{message.role === 'user' ? 'User:' : 'Bot:'}</strong> 
            <span dangerouslySetInnerHTML={{ __html: message.content }}></span>
            {(message.isTyping || (isWaitingForResponse && index === messages.length - 1)) && (
              <><span className="animate-pulse">▋</span> <br/></>
            )}
            <br/>
            {message.imageUrl && (
              <div className="relative inline-block">
                <div className="group">
                  <img 
                    src={message.imageUrl} 
                    alt="Generated image" 
                    className="mt-2 w-[200px] h-[200px] object-cover cursor-zoom-in"
                    onClick={() => handleImageClick(message.imageUrl!)}
                    onLoad={() => console.log("Image loaded successfully")}
                    onError={(e) => console.error("Error loading image:", e)}
                  />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Search className="w-8 h-8 text-white pointer-events-none" />
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </ScrollArea>
      <div className="flex space-x-2">
        <Input
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          placeholder="Type your message here..."
          onKeyPress={(e) => e.key === 'Enter' && handleSend()}
        />
        <Button
          onClick={() => {
            if (isRecording) {
              stopRecording();
            } else {
              startRecording();
            }
          }}
          className={`px-4 py-2 ${isRecording ? 'bg-red-500' : 'bg-blue-500'} text-white rounded`}
        >
          {isRecording ? 'Stop Recording' : 'Start Recording'}
          <Mic className="w-5 h-5 ml-2" />
        </Button>
        <Button onClick={handleSend} disabled={isLoading}>
          Send
        </Button>
      </div>
      <audio ref={audioRef} className="hidden" />
      {fullscreenImage && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50"
          onClick={() => setFullscreenImage(null)}
        >
          <img 
            src={fullscreenImage} 
            alt="Fullscreen image" 
            className="max-w-[90%] max-h-[90%] object-contain"
          />
        </div>
      )}
    </div>
  );
};

export default VoiceAssistant;
