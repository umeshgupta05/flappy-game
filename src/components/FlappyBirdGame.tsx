import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';

interface Bird {
  x: number;
  y: number;
  velocity: number;
}

interface Pipe {
  x: number;
  topHeight: number;
  bottomHeight: number;
  passed: boolean;
}

const GAME_WIDTH = 800;
const GAME_HEIGHT = 600;
const BIRD_SIZE = 70; // Increased for better visibility
const PIPE_WIDTH = 80;
const PIPE_GAP = 200;
const GRAVITY = 0.6;
const JUMP_FORCE = -12;
const PIPE_SPEED = 3;

export const FlappyBirdGame = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const kushiAudioRef = useRef<HTMLAudioElement | null>(null);
  
  const [gameState, setGameState] = useState<'menu' | 'playing' | 'gameOver'>('menu');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    return parseInt(localStorage.getItem('flappyBirdHighScore') || '0');
  });
  const [isLoadingSound, setIsLoadingSound] = useState(false);
  
  const [bird, setBird] = useState<Bird>({ x: 150, y: GAME_HEIGHT / 2, velocity: 0 });
  const [pipes, setPipes] = useState<Pipe[]>([]);
  const [birdImage, setBirdImage] = useState<HTMLImageElement | null>(null);
  const [gameOverImage, setGameOverImage] = useState<HTMLImageElement | null>(null);

  // Load the uploaded images
  useEffect(() => {
    // Load bird image
    const birdImg = new Image();
    birdImg.onload = () => {
      setBirdImage(birdImg);
      console.log('Bird image loaded successfully');
    };
    birdImg.onerror = () => {
      console.error('Failed to load bird image');
    };
    birdImg.src = '/lovable-uploads/d432625c-0d69-4e11-bfd4-eadd34b0e7c9.png';

    // Load game over image
    const gameOverImg = new Image();
    gameOverImg.onload = () => {
      setGameOverImage(gameOverImg);
      console.log('Game over image loaded successfully');
    };
    gameOverImg.onerror = () => {
      console.error('Failed to load game over image');
    };
    gameOverImg.src = '/lovable-uploads/379d2c43-458a-4a74-b0ff-4d27c6829bc1.png';
  }, []);

  // Generate baby voice "Kusi" sound using synthetic audio
  const generateKushiSound = useCallback(async () => {
    if (kushiAudioRef.current) {
      // Use cached audio if already generated
      return;
    }

    setIsLoadingSound(true);
    try {
      // Create a synthetic baby-like sound using Web Audio API
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const sampleRate = audioContext.sampleRate;
      const duration = 0.8; // 800ms
      const buffer = audioContext.createBuffer(1, sampleRate * duration, sampleRate);
      const channelData = buffer.getChannelData(0);

      // Generate Jerry-style teasing "Kusi" sound pattern
      for (let i = 0; i < buffer.length; i++) {
        const t = i / sampleRate;
        
        let freq1, freq2, freq3;
        let envelope = 0;
        
        if (t < 0.4) {
          // "Ku" part - Jerry's characteristic high-pitched start with downward slide
          const kuProgress = t / 0.4;
          
          // Start high and slide down like Jerry's teasing tone
          const pitch_slide = 1.0 - kuProgress * 0.3; // Slides down 30%
          freq1 = (650 * pitch_slide) + Math.sin(kuProgress * Math.PI * 6) * 30; // Jerry's high pitch with vibrato
          freq2 = (1300 * pitch_slide) + Math.sin(kuProgress * Math.PI * 8) * 25;
          freq3 = (1950 * pitch_slide) + Math.sin(kuProgress * Math.PI * 10) * 20;
          
          // Jerry's characteristic envelope - quick attack, sustained
          envelope = kuProgress < 0.1 ? kuProgress * 10 : 0.85 * (1 - kuProgress * 0.2);
        } else if (t < 0.5) {
          // Brief pause - Jerry's timing
          envelope = 0.02;
          freq1 = 500;
          freq2 = 1000;
          freq3 = 1500;
        } else {
          // "si" part - Jerry's signature upward inflection with smugness
          const siProgress = (t - 0.5) / 0.3;
          
          // Jerry's characteristic upward sweep with attitude
          const pitch_sweep = siProgress * 0.8 + Math.sin(siProgress * Math.PI * 3) * 0.2;
          freq1 = 450 + pitch_sweep * 350; // Sweeps up like Jerry's taunting
          freq2 = 900 + pitch_sweep * 500;
          freq3 = 1350 + pitch_sweep * 650;
          
          // Jerry's smug ending - gets stronger and more confident
          envelope = Math.sin(siProgress * Math.PI) * 0.9 * (0.8 + siProgress * 0.4);
          
          // Add Jerry's characteristic nasal quality at the end
          if (siProgress > 0.6) {
            freq1 *= 1 + (siProgress - 0.6) * 0.5;
            freq2 *= 1 + (siProgress - 0.6) * 0.3;
          }
        }
        
        // Jerry's voice characteristics - nasal, bright, teasing
        const fundamental = Math.sin(2 * Math.PI * freq1 * t) * 0.45;
        const nasal_harmonic = Math.sin(2 * Math.PI * freq2 * t) * 0.35; // Jerry's nasal quality
        const bright_harmonic = Math.sin(2 * Math.PI * freq3 * t) * 0.25; // Brightness
        
        // Add Jerry's characteristic mouth noise and sassiness
        const sassy_noise = Math.sin(2 * Math.PI * freq1 * 2.1 * t) * 0.1;
        const mouse_squeakiness = (Math.random() - 0.5) * 0.05;
        
        const sample = (fundamental + nasal_harmonic + bright_harmonic + sassy_noise + mouse_squeakiness) * envelope;
        
        channelData[i] = Math.max(-1, Math.min(1, sample));
      }

      // Create audio from buffer
      const source = audioContext.createBufferSource();
      source.buffer = buffer;
      
      // Convert to blob and create audio element
      const offlineContext = new OfflineAudioContext(1, buffer.length, sampleRate);
      const offlineSource = offlineContext.createBufferSource();
      offlineSource.buffer = buffer;
      offlineSource.connect(offlineContext.destination);
      offlineSource.start();
      
      const renderedBuffer = await offlineContext.startRendering();
      const audioData = renderedBuffer.getChannelData(0);
      
      // Convert to WAV format
      const wavBuffer = createWavBuffer(audioData, sampleRate);
      const audioBlob = new Blob([wavBuffer], { type: 'audio/wav' });
      const audioUrl = URL.createObjectURL(audioBlob);
      kushiAudioRef.current = new Audio(audioUrl);
      console.log('Jerry-style teasing "Kusi" sound generated!');
    } catch (error) {
      console.error('Error generating Kusi sound:', error);
    } finally {
      setIsLoadingSound(false);
    }
  }, []);

  // Helper function to create WAV buffer
  const createWavBuffer = (audioData: Float32Array, sampleRate: number) => {
    const length = audioData.length;
    const buffer = new ArrayBuffer(44 + length * 2);
    const view = new DataView(buffer);
    
    // WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, length * 2, true);
    
    // Convert float samples to 16-bit PCM
    let offset = 44;
    for (let i = 0; i < length; i++) {
      const sample = Math.max(-1, Math.min(1, audioData[i]));
      view.setInt16(offset, sample * 0x7FFF, true);
      offset += 2;
    }
    
    return buffer;
  };

  // Generate sound when component mounts
  useEffect(() => {
    generateKushiSound();
  }, [generateKushiSound]);

  const playKusiSound = useCallback(() => {
    try {
      if (kushiAudioRef.current) {
        kushiAudioRef.current.currentTime = 0;
        kushiAudioRef.current.play().catch(console.error);
      } else {
        // Fallback to simple beep if no API key
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
        
        oscillator.type = 'sine';
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.1);
      }
    } catch (error) {
      console.log('Could not play sound:', error);
    }
  }, []);

  const resetGame = useCallback(() => {
    setBird({ x: 150, y: GAME_HEIGHT / 2, velocity: 0 });
    setPipes([]);
    setScore(0);
  }, []);

  const jump = useCallback(() => {
    if (gameState === 'playing') {
      setBird(prev => ({ ...prev, velocity: JUMP_FORCE }));
      playKusiSound();
    }
  }, [gameState, playKusiSound]);

  const startGame = useCallback(() => {
    resetGame();
    setGameState('playing');
  }, [resetGame]);

  const endGame = useCallback(() => {
    setGameState('gameOver');
    if (score > highScore) {
      setHighScore(score);
      localStorage.setItem('flappyBirdHighScore', score.toString());
    }
  }, [score, highScore]);

  // Game loop with proper cleanup
  useEffect(() => {
    if (gameState !== 'playing') {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      return;
    }

    let isRunning = true;

    const gameLoop = () => {
      if (!isRunning) return;
      
      // Update bird physics
      setBird(prev => ({
        ...prev,
        y: prev.y + prev.velocity,
        velocity: prev.velocity + GRAVITY
      }));

      // Update pipes
      setPipes(prev => {
        let newPipes = [...prev];
        
        // Move pipes
        newPipes = newPipes.map(pipe => ({ ...pipe, x: pipe.x - PIPE_SPEED }));
        
        // Remove pipes that are off screen
        newPipes = newPipes.filter(pipe => pipe.x > -PIPE_WIDTH);
        
        // Add new pipes
        if (newPipes.length === 0 || newPipes[newPipes.length - 1].x < GAME_WIDTH - 300) {
          const topHeight = Math.random() * (GAME_HEIGHT - PIPE_GAP - 100) + 50;
          newPipes.push({
            x: GAME_WIDTH,
            topHeight,
            bottomHeight: GAME_HEIGHT - topHeight - PIPE_GAP,
            passed: false
          });
        }

        return newPipes;
      });

      if (isRunning) {
        animationRef.current = requestAnimationFrame(gameLoop);
      }
    };

    animationRef.current = requestAnimationFrame(gameLoop);

    return () => {
      isRunning = false;
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [gameState]);

  // Collision detection and scoring
  useEffect(() => {
    if (gameState !== 'playing') return;

    // Check ground and ceiling collision
    if (bird.y > GAME_HEIGHT - BIRD_SIZE - 20 || bird.y < 0) {
      endGame();
      return;
    }

    // Check pipe collision and scoring
    pipes.forEach(pipe => {
      // Check if bird passed the pipe for scoring
      if (!pipe.passed && pipe.x + PIPE_WIDTH < bird.x) {
        pipe.passed = true;
        setScore(prev => prev + 1);
      }

      // Check collision with pipe
      if (
        bird.x + BIRD_SIZE > pipe.x &&
        bird.x < pipe.x + PIPE_WIDTH &&
        (bird.y < pipe.topHeight || bird.y + BIRD_SIZE > GAME_HEIGHT - pipe.bottomHeight)
      ) {
        endGame();
      }
    });
  }, [bird, pipes, gameState, endGame]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        event.preventDefault();
        if (gameState === 'menu' || gameState === 'gameOver') {
          startGame();
        } else {
          jump();
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [gameState, startGame, jump]);

  // Canvas rendering with improved bird visibility
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Draw background gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
    gradient.addColorStop(0, 'hsl(200, 100%, 70%)');
    gradient.addColorStop(1, 'hsl(200, 100%, 40%)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Draw animated clouds
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    for (let i = 0; i < 3; i++) {
      const x = (i * 300 + Date.now() * 0.01) % (GAME_WIDTH + 100);
      ctx.beginPath();
      ctx.arc(x, 100 + i * 50, 30, 0, Math.PI * 2);
      ctx.arc(x + 25, 100 + i * 50, 35, 0, Math.PI * 2);
      ctx.arc(x + 50, 100 + i * 50, 30, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw pipes
    pipes.forEach(pipe => {
      ctx.fillStyle = 'hsl(120, 60%, 35%)';
      // Top pipe
      ctx.fillRect(pipe.x, 0, PIPE_WIDTH, pipe.topHeight);
      // Bottom pipe
      ctx.fillRect(pipe.x, GAME_HEIGHT - pipe.bottomHeight, PIPE_WIDTH, pipe.bottomHeight);
      
      // Pipe caps for 3D effect
      ctx.fillStyle = 'hsl(120, 60%, 25%)';
      ctx.fillRect(pipe.x - 5, pipe.topHeight - 30, PIPE_WIDTH + 10, 30);
      ctx.fillRect(pipe.x - 5, GAME_HEIGHT - pipe.bottomHeight, PIPE_WIDTH + 10, 30);
    });

    // Draw bird with full image (no circular clipping)
    if (birdImage && birdImage.complete) {
      ctx.save();
      const rotation = Math.min(Math.max(bird.velocity * 0.1, -Math.PI / 6), Math.PI / 4);
      ctx.translate(bird.x + BIRD_SIZE / 2, bird.y + BIRD_SIZE / 2);
      ctx.rotate(rotation);
      
      // Calculate scale to fit image properly while maintaining aspect ratio
      const scale = Math.min(BIRD_SIZE / birdImage.width, BIRD_SIZE / birdImage.height);
      const scaledWidth = birdImage.width * scale;
      const scaledHeight = birdImage.height * scale;
      
      // Draw the full image without clipping
      ctx.drawImage(
        birdImage, 
        -scaledWidth / 2, 
        -scaledHeight / 2, 
        scaledWidth, 
        scaledHeight
      );
      
      ctx.restore();
    } else {
      // Default bird fallback with larger size
      ctx.fillStyle = 'hsl(45, 100%, 50%)';
      ctx.beginPath();
      ctx.arc(bird.x + BIRD_SIZE / 2, bird.y + BIRD_SIZE / 2, BIRD_SIZE / 2, 0, Math.PI * 2);
      ctx.fill();
      
      // Bird eye
      ctx.fillStyle = 'white';
      ctx.beginPath();
      ctx.arc(bird.x + BIRD_SIZE * 0.7, bird.y + BIRD_SIZE * 0.3, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'black';
      ctx.beginPath();
      ctx.arc(bird.x + BIRD_SIZE * 0.7, bird.y + BIRD_SIZE * 0.3, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw ground
    ctx.fillStyle = 'hsl(30, 60%, 45%)';
    ctx.fillRect(0, GAME_HEIGHT - 20, GAME_WIDTH, 20);

  }, [bird, pipes, birdImage]);

  return (
    <div className="flex flex-col items-center gap-6 p-6 bg-background min-h-screen">
      {/* Game Area */}
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={GAME_WIDTH}
          height={GAME_HEIGHT}
          className="border-2 border-primary rounded-lg shadow-lg cursor-pointer"
          onClick={gameState === 'playing' ? jump : startGame}
        />

        {/* Game Overlay */}
        {gameState === 'menu' && (
          <div className="absolute inset-0 bg-background/80 flex items-center justify-center rounded-lg">
            <div className="text-center space-y-4 animate-bounce-in">
              <p className="text-muted-foreground">Click or press SPACE to start</p>
              <Button onClick={startGame} className="animate-pulse-glow">
                Start Game
              </Button>
            </div>
          </div>
        )}

        {gameState === 'gameOver' && (
          <div className="absolute inset-0 bg-background/90 flex items-center justify-center rounded-lg">
            <div className="text-center space-y-4 animate-slide-up">
              {gameOverImage && (
                <div className="w-48 h-48 mx-auto border-4 border-destructive rounded-lg overflow-hidden comedy-peak">
                  <img src={gameOverImage.src} alt="Game Over" className="w-full h-full object-cover" />
                </div>
              )}
              <h2 className="text-3xl font-bold text-destructive">Game Over!</h2>
              <p className="text-xl text-foreground">Score: {score}</p>
              <p className="text-lg text-muted-foreground">High Score: {highScore}</p>
              <Button onClick={startGame} variant="destructive" className="animate-pulse-glow">
                Try Again
              </Button>
            </div>
          </div>
        )}

        {/* Score Display */}
        {gameState === 'playing' && (
          <div className="absolute top-4 left-4 text-2xl font-bold text-accent animate-float">
            Score: {score}
          </div>
        )}
      </div>

      
    </div>
  );
};