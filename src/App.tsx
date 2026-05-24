import { useEffect, useRef, useState } from 'react';
import { runSimulation } from './simulation';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [showMessage, setShowMessage] = useState(true);

  useEffect(() => {
    if (!canvasRef.current) return;
    const cleanup = runSimulation(canvasRef.current);
    
    const timeout = setTimeout(() => {
      setShowMessage(false);
    }, 4000);

    return () => {
      cleanup();
      clearTimeout(timeout);
    };
  }, []);

  return (
    <div className="relative w-full h-screen bg-sky-900 overflow-hidden m-0 p-0">
      <canvas ref={canvasRef} className="block w-full h-full" />
      <div className={`absolute top-8 left-8 text-white/80 text-xl font-sans font-medium pointer-events-none drop-shadow-md select-none tracking-wide transition-opacity duration-1000 ${showMessage ? 'opacity-100' : 'opacity-0'}`}>
        Tap or click to summon a fish.
      </div>
    </div>
  );
}
