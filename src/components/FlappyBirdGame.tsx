import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';

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
  const [apiKey, setApiKey] = useState('');
  const [isLoadingSound, setIsLoadingSound] = useState(false);
  
  const [bird, setBird] = useState<Bird>({ x: 150, y: GAME_HEIGHT / 2, velocity: 0 });
  const [pipes, setPipes] = useState<Pipe[]>([]);
  const [birdImage, setBirdImage] = useState<HTMLImageElement | null>(null);
  const [gameOverImage, setGameOverImage] = useState<HTMLImageElement | null>(null);

  // Load the uploaded image as bird
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      setBirdImage(img);
      console.log('Bird image loaded successfully');
      toast.success('Target loaded! Ready to troll! 😈');
    };
    img.onerror = () => {
      console.error('Failed to load bird image');
      toast.error('Failed to load bird image');
    };
    img.src = '/lovable-uploads/bd09b71c-cd72-4f8d-bf5b-ad7618882730.png';
  }, []);

  // Generate baby voice "Kusi" sound using ElevenLabs
  const generateKushiSound = useCallback(async () => {
    if (!apiKey) {
      toast.error('Please enter your ElevenLabs API key first!');
      return;
    }

    if (kushiAudioRef.current) {
      // Use cached audio if already generated
      return;
    }

    setIsLoadingSound(true);
    try {
      const response = await fetch('https://api.elevenlabs.io/v1/text-to-speech/pFZP5JQG7iQjIQuC4Bku', {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': apiKey
        },
        body: JSON.stringify({
          text: "Kusi!",
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.8,
            style: 1.0,
            use_speaker_boost: true
          }
        })
      });

      if (!response.ok) {
        throw new Error(`ElevenLabs API error: ${response.status}`);
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      kushiAudioRef.current = new Audio(audioUrl);
      
      toast.success('Baby voice "Kusi" sound generated! 👶');
    } catch (error) {
      console.error('Error generating Kusi sound:', error);
      toast.error('Failed to generate baby voice. Check your API key!');
    } finally {
      setIsLoadingSound(false);
    }
  }, [apiKey]);

  // Generate sound when API key is provided
  useEffect(() => {
    if (apiKey) {
      generateKushiSound();
    }
  }, [apiKey, generateKushiSound]);

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
    toast.success('Game started! Press space or click to jump!');
  }, [resetGame]);

  const endGame = useCallback(() => {
    setGameState('gameOver');
    if (score > highScore) {
      setHighScore(score);
      localStorage.setItem('flappyBirdHighScore', score.toString());
      toast.success(`New high score: ${score}! 🏆`);
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

    // Draw bird with improved visibility and rotation
    if (birdImage && birdImage.complete) {
      ctx.save();
      const rotation = Math.min(Math.max(bird.velocity * 0.1, -Math.PI / 6), Math.PI / 4);
      ctx.translate(bird.x + BIRD_SIZE / 2, bird.y + BIRD_SIZE / 2);
      ctx.rotate(rotation);
      
      // Draw glowing border for maximum visibility
      ctx.shadowColor = 'hsl(280, 100%, 65%)';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(0, 0, BIRD_SIZE / 2 + 4, 0, Math.PI * 2);
      ctx.fillStyle = 'hsl(280, 100%, 65%)';
      ctx.fill();
      
      ctx.shadowBlur = 0;
      
      // Draw white border for contrast
      ctx.beginPath();
      ctx.arc(0, 0, BIRD_SIZE / 2 + 2, 0, Math.PI * 2);
      ctx.fillStyle = 'white';
      ctx.fill();
      
      // Draw the image in a circle with proper scaling
      ctx.beginPath();
      ctx.arc(0, 0, BIRD_SIZE / 2, 0, Math.PI * 2);
      ctx.clip();
      
      // Calculate scale to fit image properly in circle while maintaining aspect ratio
      const scale = Math.min(BIRD_SIZE / birdImage.width, BIRD_SIZE / birdImage.height);
      const scaledWidth = birdImage.width * scale;
      const scaledHeight = birdImage.height * scale;
      
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
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-bold text-primary animate-pulse-glow">
          🐦 Trolly Bird 🐦
        </h1>
        <p className="text-muted-foreground">The ultimate trolling game! Make them struggle!</p>
      </div>

      {/* ElevenLabs API Key Input */}
      <Card className="p-4 w-full max-w-md">
        <h3 className="font-semibold text-primary mb-3">🎵 Baby Voice Setup</h3>
        <div className="space-y-3">
          <Input
            type="password"
            placeholder="Enter your ElevenLabs API key..."
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="w-full"
          />
          <p className="text-xs text-muted-foreground">
            Get your API key from{' '}
            <a href="https://elevenlabs.io/" target="_blank" rel="noopener noreferrer" className="text-primary underline">
              ElevenLabs
            </a>{' '}
            for baby voice "Kusi" sound
          </p>
          {isLoadingSound && (
            <p className="text-sm text-accent">Generating baby voice... 👶</p>
          )}
          {kushiAudioRef.current && (
            <p className="text-sm text-green-500">✅ Baby voice ready!</p>
          )}
        </div>
      </Card>

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
              <h2 className="text-3xl font-bold text-primary">Ready to Troll?</h2>
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
                <div className="w-32 h-32 mx-auto border-4 border-destructive rounded-full overflow-hidden animate-bounce-in">
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

      {/* Instructions */}
      <div className="text-center text-sm text-muted-foreground max-w-md space-y-2">
        <p>🎮 Click the canvas or press SPACE to jump</p>
        <p>🎵 Listen for the baby voice "Kusi" sound on each jump</p>
        <p>😈 Watch them struggle with their own face!</p>
        <p className="text-primary font-semibold">✨ Target's photo is now clearly visible!</p>
      </div>
    </div>
  );
};