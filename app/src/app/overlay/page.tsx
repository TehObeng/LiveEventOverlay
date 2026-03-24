'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { createBrowserClient, isSupabaseConfigured } from '@/lib/supabase';
import { OverlayConfig, DEFAULT_OVERLAY_CONFIG, Message } from '@/lib/types';

interface ActiveMessage {
  id: string;
  text: string;
  senderName: string | null;
  lane: number;
  x: number;
  startTime: number;
}

function OverlayContent() {
  const searchParams = useSearchParams();
  const eventId = searchParams.get('eventId');

  if (!isSupabaseConfigured()) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        color: '#a29bfe',
        fontFamily: 'Inter, sans-serif',
        flexDirection: 'column',
        gap: 12,
        background: '#0a0a12',
      }}>
        <div style={{ fontSize: 48 }}>⚙️</div>
        <div style={{ fontSize: 18, fontWeight: 600 }}>Supabase Belum Dikonfigurasi</div>
        <div style={{ fontSize: 14, color: '#9898b0', maxWidth: 400, textAlign: 'center' }}>
          Edit file <code>.env.local</code> dengan URL dan Key dari project Supabase kamu, lalu restart server.
        </div>
      </div>
    );
  }

  const supabase = createBrowserClient();

  const [config, setConfig] = useState<OverlayConfig>(DEFAULT_OVERLAY_CONFIG);
  const [activeMessages, setActiveMessages] = useState<ActiveMessage[]>([]);
  const messageQueueRef = useRef<{ text: string; senderName: string | null }[]>([]);
  const activeMessagesRef = useRef<ActiveMessage[]>([]);
  const animationFrameRef = useRef<number>(0);
  const lastSpawnRef = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Keep ref in sync with state
  useEffect(() => {
    activeMessagesRef.current = activeMessages;
  }, [activeMessages]);

  // ============================================
  // Fetch event overlay config
  // ============================================
  useEffect(() => {
    if (!eventId) return;

    const fetchConfig = async () => {
      const { data } = await supabase
        .from('events')
        .select('overlay_config')
        .eq('id', eventId)
        .single();

      if (data?.overlay_config) {
        setConfig({ ...DEFAULT_OVERLAY_CONFIG, ...data.overlay_config });
      }
    };

    fetchConfig();

    // Also listen for config changes via polling (every 5s)
    const configInterval = setInterval(fetchConfig, 5000);
    return () => clearInterval(configInterval);
  }, [eventId, supabase]);

  // ============================================
  // Realtime: Listen for approved messages
  // ============================================
  useEffect(() => {
    if (!eventId) return;

    // Listen for newly approved messages (postgres_changes)
    const msgChannel = supabase
      .channel(`overlay-messages-${eventId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `event_id=eq.${eventId}`,
        },
        (payload) => {
          const msg = payload.new as Message;
          if (msg.status === 'approved') {
            messageQueueRef.current.push({
              text: msg.sender_name ? `${msg.sender_name}: ${msg.text}` : msg.text,
              senderName: msg.sender_name,
            });
          }
        }
      )
      .subscribe();

    // Listen for clear_screen broadcast
    const controlChannel = supabase
      .channel(`overlay-${eventId}`)
      .on('broadcast', { event: 'clear_screen' }, () => {
        setActiveMessages([]);
        activeMessagesRef.current = [];
        messageQueueRef.current = [];
      })
      .subscribe();

    return () => {
      supabase.removeChannel(msgChannel);
      supabase.removeChannel(controlChannel);
    };
  }, [eventId, supabase]);

  // ============================================
  // Lane Assignment (collision avoidance)
  // ============================================
  const assignLane = useCallback((): number => {
    const active = activeMessagesRef.current;
    const container = containerRef.current;
    if (!container) return 0;

    const containerWidth = container.offsetWidth;
    const laneCount = config.laneCount;

    // Find the lane with the most "clearance"
    // (where the rightmost message is furthest to the right or no message)
    let bestLane = 0;
    let bestClearance = -Infinity;

    for (let lane = 0; lane < laneCount; lane++) {
      const laneMessages = active.filter(m => m.lane === lane);
      if (laneMessages.length === 0) {
        return lane; // Empty lane, use it immediately
      }

      // Find the message that was most recently spawned in this lane
      const latestMsg = laneMessages.reduce((latest, m) =>
        m.startTime > latest.startTime ? m : latest
      );

      // Calculate how far it has moved
      const elapsed = (Date.now() - latestMsg.startTime) / 1000;
      const distance = elapsed * config.speed;

      // If it's cleared at least 40% of the screen, this lane is available
      if (distance > containerWidth * 0.4) {
        const clearance = distance;
        if (clearance > bestClearance) {
          bestClearance = clearance;
          bestLane = lane;
        }
      }
    }

    return bestLane;
  }, [config.laneCount, config.speed]);

  // ============================================
  // Animation Loop
  // ============================================
  useEffect(() => {
    const animate = () => {
      const now = Date.now();
      const container = containerRef.current;

      if (container) {
        const containerWidth = container.offsetWidth;

        // Spawn new messages from queue
        if (
          messageQueueRef.current.length > 0 &&
          now - lastSpawnRef.current > config.spawnInterval &&
          activeMessagesRef.current.length < config.maxMessages
        ) {
          const { text, senderName } = messageQueueRef.current.shift()!;
          const lane = assignLane();
          const newMsg: ActiveMessage = {
            id: `${now}-${Math.random()}`,
            text,
            senderName,
            lane,
            x: -10, // Start just off-screen left (percentage)
            startTime: now,
          };

          activeMessagesRef.current = [...activeMessagesRef.current, newMsg];
          lastSpawnRef.current = now;
        }

        // Update positions & remove expired messages
        const updated = activeMessagesRef.current
          .map(msg => {
            const elapsed = (now - msg.startTime) / 1000;
            const pxMoved = elapsed * config.speed;
            const xPercent = (pxMoved / containerWidth) * 100 - 10; // offset for starting left
            return { ...msg, x: xPercent };
          })
          .filter(msg => {
            const elapsed = (now - msg.startTime) / 1000;
            return elapsed < config.maxLifetime && msg.x < 110; // Remove after exiting right
          });

        if (
          updated.length !== activeMessagesRef.current.length ||
          updated.some((m, i) => m.x !== activeMessagesRef.current[i]?.x)
        ) {
          activeMessagesRef.current = updated;
          setActiveMessages([...updated]);
        }
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrameRef.current);
  }, [config, assignLane]);

  // ============================================
  // Calculate lane Y position
  // ============================================
  const getLaneY = (lane: number): number => {
    const totalHeight = 100; // percentage
    const padding = 5; // percentage from top/bottom
    const usableHeight = totalHeight - padding * 2;
    const laneHeight = usableHeight / config.laneCount;
    return padding + lane * laneHeight + laneHeight / 2;
  };

  if (!eventId) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        color: '#666',
        fontFamily: 'Inter, sans-serif',
      }}>
        No eventId specified
      </div>
    );
  }

  return (
    <div className="overlay-page" ref={containerRef}>
      {activeMessages.map(msg => (
        <div
          key={msg.id}
          className="overlay-message"
          style={{
            left: `${msg.x}%`,
            top: `${getLaneY(msg.lane)}%`,
            transform: 'translateY(-50%)',
            fontSize: `${config.fontSize}px`,
            color: config.color,
            fontFamily: config.fontFamily,
            opacity: config.opacity,
            WebkitTextStrokeColor: config.stroke,
            textShadow: config.shadow
              ? `2px 2px 4px rgba(0,0,0,0.8), -1px -1px 2px rgba(0,0,0,0.5)`
              : 'none',
          }}
        >
          {msg.text}
        </div>
      ))}
    </div>
  );
}

export default function OverlayPage() {
  return (
    <Suspense fallback={<div className="overlay-page" />}>
      <OverlayContent />
    </Suspense>
  );
}
