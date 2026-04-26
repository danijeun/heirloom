import { useMemo } from "react";

export function Particles() {
  const particles = useMemo(() =>
    Array.from({ length: 18 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 1.5 + Math.random() * 2,
      dur: 5 + Math.random() * 6,
      delay: -(Math.random() * 9),
      color: i % 3 === 0 ? 'rgba(201,150,47,0.25)' : 'rgba(150,120,231,0.3)',
    })), []);

  return (
    <>
      {particles.map(p => (
        <div key={p.id} className="particle" style={{
          left: `${p.x}%`,
          bottom: `${p.y}%`,
          width: p.size,
          height: p.size,
          background: p.color,
          animationDuration: `${p.dur}s`,
          animationDelay: `${p.delay}s`,
        }}/>
      ))}
    </>
  );
}
