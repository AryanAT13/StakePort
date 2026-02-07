'use client';

import { useState, useEffect } from 'react';

type MarketEvent = {
  title: string;
  topAnswer: string;
  probability: number;
};

export default function MarketPulse() {
  const [events, setEvents] = useState<MarketEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchMarkets() {
      try {
        const res = await fetch('/api/polymarket');
        const data = await res.json();
        setEvents(data);
        setLoading(false);
      } catch (err) {
        console.error(err);
        setLoading(false);
      }
    }
    fetchMarkets();
  }, []);

  if (loading) return null;

  // Quadruple the list (4x) to ensure the loop is seamless even on huge screens
  const seamlessLoop = [...events, ...events, ...events, ...events];

  return (
    <div className="w-full bg-black border-y border-zinc-900 py-2 overflow-hidden flex items-center relative z-10">
      
      {/* The Scrolling Container */}
      <div className="flex animate-marquee hover:[animation-play-state:paused]">
        
        {seamlessLoop.map((event, i) => (
            <div key={i} className="flex items-center gap-2 mx-8 whitespace-nowrap">
                <span className="text-xs text-gray-400 font-medium">{event.title}:</span>
                <span className="text-xs font-bold text-white">
                    {event.topAnswer}
                </span>
                <span className={`text-xs font-bold ${event.probability > 0.5 ? 'text-green-400' : 'text-blue-400'}`}>
                    {Math.round(event.probability * 100)}%
                </span>
                <span className="text-zinc-800 text-[10px] ml-4">|</span>
            </div>
        ))}
      </div>
    </div>
  );
}