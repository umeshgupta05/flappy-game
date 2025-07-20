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
const BIRD_SIZE = 90; // Increased for better visibility
const PIPE_WIDTH = 80;
const PIPE_GAP = 200;
const GRAVITY = 0.6;
const JUMP_FORCE = -12;
const PIPE_SPEED = 3;

export const FlappyBirdGame = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const [apiKey, setApiKey] = useState<string>('');
  
  const [gameState, setGameState] = useState<'menu' | 'playing' | 'gameOver'>('menu');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    return parseInt(localStorage.getItem('flappyBirdHighScore') || '0');
  });
  const [isLoadingSound, setIsLoadingSound] = useState(false);
  const [showKusiAnimation, setShowKusiAnimation] = useState(false);
  
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

  // Generate text-to-speech "Kusi" sound using ElevenLabs
  const playKusiTTS = useCallback(async () => {
    if (!apiKey) {
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
      return;
    }

    try {
      const response = await fetch('https://api.elevenlabs.io/v1/text-to-speech/pFZP5JQG7iQjIQuC4Bku', {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': apiKey,
        },
        body: JSON.stringify({
          text: 'Kusi',
          model_id: 'eleven_turbo_v2',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.8,
            style: 0.8,
            use_speaker_boost: true
          }
        }),
      });

      if (response.ok) {
        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        audio.play().catch(console.error);
      }
    } catch (error) {
      console.error('Error playing TTS:', error);
    }
  }, [apiKey]);

  const resetGame = useCallback(() => {
    setBird({ x: 150, y: GAME_HEIGHT / 2, velocity: 0 });
    setPipes([]);
    setScore(0);
  }, []);

  const jump = useCallback(() => {
    if (gameState === 'playing') {
      setBird(prev => ({ ...prev, velocity: JUMP_FORCE }));
      playKusiTTS();
    }
  }, [gameState, playKusiTTS]);

  const startGame = useCallback(() => {
    resetGame();
    setGameState('playing');
  }, [resetGame]);

  const endGame = useCallback(() => {
    setGameState('gameOver');
    setShowKusiAnimation(true);
    setTimeout(() => setShowKusiAnimation(false), 6000); // Show animation for 6 seconds
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

    // Draw bird with maximum visibility - larger size, no clipping
    if (birdImage && birdImage.complete) {
      ctx.save();
      const rotation = Math.min(Math.max(bird.velocity * 0.1, -Math.PI / 6), Math.PI / 4);
      ctx.translate(bird.x + BIRD_SIZE / 2, bird.y + BIRD_SIZE / 2);
      ctx.rotate(rotation);
      
      // Add glowing background for maximum visibility
      ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
      ctx.shadowBlur = 15;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.fillRect(-BIRD_SIZE / 2 - 5, -BIRD_SIZE / 2 - 5, BIRD_SIZE + 10, BIRD_SIZE + 10);
      ctx.shadowBlur = 0;
      
      // Draw the full image without any clipping
      ctx.drawImage(
        birdImage, 
        -BIRD_SIZE / 2, 
        -BIRD_SIZE / 2, 
        BIRD_SIZE, 
        BIRD_SIZE
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
      {/* API Key Input */}
      {!apiKey && (
        <Card className="p-4 w-full max-w-md">
          <div className="space-y-3">
            <h3 className="text-lg font-semibold">ElevenLabs API Key</h3>
            <p className="text-sm text-muted-foreground">Enter your ElevenLabs API key for girl voice "Kusi" sound:</p>
            <Input
              type="password"
              placeholder="Enter API key..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
            <Button onClick={() => setApiKey(apiKey)} className="w-full">
              Save API Key
            </Button>
          </div>
        </Card>
      )}

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
              {showKusiAnimation && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  {[...Array(8)].map((_, i) => (
                    <div
                      key={i}
                      className="kusi-crazy text-8xl font-bold absolute"
                      style={{
                        left: `${Math.random() * 80 + 10}%`,
                        top: `${Math.random() * 80 + 10}%`,
                        animationDelay: `${i * 0.2}s`,
                      }}
                    >
                      KUSI
                    </div>
                  ))}
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
        <p>🎵 Girl voice "Kusi" sound on each jump</p>
        <p>🎭 Crazy "KUSI" animations when you lose!</p>
        <p className="text-primary font-semibold">✨ Photo is now fully visible!</p>
      </div>
    </div>
  );
};