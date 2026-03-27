'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { fetchPublicEvent, fetchPublicMessages } from '@/lib/public-api';
import {
  createOverlayLaneState,
  getCenteredLanePosition,
  hexToRgba,
  isHorizontalDirection,
  OverlayLaneState,
  pickRandomLane,
} from '@/lib/overlay';
import { DEFAULT_OVERLAY_CONFIG, OverlayConfig, PublicApprovedMessage, ScrollDirection } from '@/lib/types';

interface OverlayMessage {
  id: string;
  text: string;
  senderName: string | null;
  approvedAt: string | null;
  el?: HTMLDivElement;
  lane: number;
  pos: number;
  speed: number;
  startTime: number;
  size: number;
}

function OverlayContent() {
  const searchParams = useSearchParams();
  const eventId = searchParams.get('eventId');
  const obsMode = searchParams.get('obs') === '1';

  const [config, setConfig] = useState<OverlayConfig>({ ...DEFAULT_OVERLAY_CONFIG });
  const [eventLoading, setEventLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const configRef = useRef<OverlayConfig>({ ...DEFAULT_OVERLAY_CONFIG });
  const danmakuRef = useRef<HTMLDivElement>(null);
  const tiktokRef = useRef<HTMLDivElement>(null);
  const queueRef = useRef<OverlayMessage[]>([]);
  const activeRef = useRef<Map<string, OverlayMessage>>(new Map());
  const lanesRef = useRef<OverlayLaneState[]>(createOverlayLaneState(DEFAULT_OVERLAY_CONFIG.laneCount));
  const seenRef = useRef<Set<string>>(new Set());
  const animationRef = useRef(0);
  const lastSpawnRef = useRef(0);
  const widthRef = useRef(1920);
  const heightRef = useRef(1080);
  const destroyedRef = useRef(false);
  const sessionStartRef = useRef('');
  const sinceRef = useRef('');
  const clearedAtRef = useRef<string | null>(null);

  useEffect(() => {
    document.documentElement.classList.add('overlay-mode');
    return () => {
      document.documentElement.classList.remove('overlay-mode');
    };
  }, []);

  const updateDimensions = useCallback(() => {
    if (!danmakuRef.current) return;
    widthRef.current = danmakuRef.current.offsetWidth || 1920;
    heightRef.current = danmakuRef.current.offsetHeight || 1080;
  }, []);

  const escapeHtml = useCallback((text: string) => {
    const element = document.createElement('div');
    element.textContent = text;
    return element.innerHTML;
  }, []);

  const clearOverlayState = useCallback((resetSeen = false) => {
    activeRef.current.forEach((message) => {
      message.el?.remove();
    });
    activeRef.current.clear();
    queueRef.current.length = 0;

    if (tiktokRef.current) {
      tiktokRef.current.innerHTML = '';
    }

    if (resetSeen) {
      seenRef.current.clear();
    }
  }, []);

  const applyConfig = useCallback((nextConfig: OverlayConfig) => {
    const previousConfig = configRef.current;
    configRef.current = nextConfig;
    setConfig(nextConfig);

    if (nextConfig.laneCount !== previousConfig.laneCount) {
      lanesRef.current = createOverlayLaneState(nextConfig.laneCount);
    }

    if (nextConfig.scrollType !== previousConfig.scrollType) {
      clearOverlayState();
    }

    if (danmakuRef.current) {
      danmakuRef.current.style.setProperty(
        '--overlay-bg',
        nextConfig.bgOpacity > 0 ? hexToRgba(nextConfig.bgColor, nextConfig.bgOpacity) : 'transparent',
      );
    }

    if (tiktokRef.current) {
      tiktokRef.current.style.display = nextConfig.scrollType === 'tiktok' ? 'flex' : 'none';
    }
  }, [clearOverlayState]);

  const getSpawnPosition = useCallback((direction: ScrollDirection) => {
    switch (direction) {
      case 'rtl':
        return widthRef.current;
      case 'ltr':
        return -300;
      case 'ttb':
        return -100;
      case 'btt':
        return heightRef.current;
    }
  }, []);

  const getRandomizedSpeed = useCallback(() => {
    const currentConfig = configRef.current;
    const variance = currentConfig.speedVariance || 0;
    const factor = 1 + (Math.random() * 2 - 1) * variance;
    return Math.max(20, currentConfig.speed * factor);
  }, []);

  const measureHorizontalText = useCallback((text: string, currentConfig: OverlayConfig) => {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    if (context) {
      context.font = `bold ${currentConfig.fontSize}px ${currentConfig.fontFamily}, Arial, sans-serif`;
      return context.measureText(text).width + 30;
    }

    return text.length * currentConfig.fontSize * 0.6 + 30;
  }, []);

  const getTextShadow = useCallback((currentConfig: OverlayConfig) => {
    const parts: string[] = [];

    if (currentConfig.strokeWidth > 0) {
      const size = currentConfig.strokeWidth;
      const color = currentConfig.stroke;
      parts.push(
        `-${size}px -${size}px 0 ${color}`,
        `${size}px -${size}px 0 ${color}`,
        `-${size}px ${size}px 0 ${color}`,
        `${size}px ${size}px 0 ${color}`,
      );
    }

    if (currentConfig.shadow) {
      parts.push('0 0 10px rgba(0,0,0,0.8)', '0 0 20px rgba(0,0,0,0.6)');
    }

    return parts.join(',') || 'none';
  }, []);

  const getLanePosition = useCallback((lane: number) => {
    const currentConfig = configRef.current;
    const containerSize = isHorizontalDirection(currentConfig.scrollDirection)
      ? heightRef.current
      : widthRef.current;

    return getCenteredLanePosition({
      lane,
      laneCount: currentConfig.laneCount,
      fontSize: currentConfig.fontSize,
      gapVertical: currentConfig.gapVertical,
      containerSize,
    });
  }, []);

  const isLaneClear = useCallback((laneIndex: number) => {
    const lane = lanesRef.current[laneIndex];
    if (!lane || lane.lastTime === 0) {
      return true;
    }

    const currentConfig = configRef.current;
    const elapsed = (Date.now() - lane.lastTime) / 1000;
    const edge = (() => {
      switch (currentConfig.scrollDirection) {
        case 'rtl':
          return lane.lastEdge - elapsed * lane.lastSpeed;
        case 'ltr':
          return lane.lastEdge + elapsed * lane.lastSpeed;
        case 'ttb':
          return lane.lastEdge + elapsed * lane.lastSpeed;
        case 'btt':
          return lane.lastEdge - elapsed * lane.lastSpeed;
      }
    })();

    const gap = currentConfig.gapHorizontal;
    switch (currentConfig.scrollDirection) {
      case 'rtl':
        return edge < widthRef.current - gap;
      case 'ltr':
        return edge > gap;
      case 'ttb':
        return edge > gap;
      case 'btt':
        return edge < heightRef.current - gap;
    }
  }, []);

  const spawnDanmakuMessage = useCallback((message: OverlayMessage) => {
    const container = danmakuRef.current;
    if (!container) return;

    const currentConfig = configRef.current;
    const isHorizontal = isHorizontalDirection(currentConfig.scrollDirection);
    const size = isHorizontal
      ? measureHorizontalText(message.text, currentConfig)
      : currentConfig.fontSize + 16;
    const lane = pickRandomLane(currentConfig.laneCount, isLaneClear);

    if (!isLaneClear(lane)) {
      queueRef.current.unshift(message);
      return;
    }

    const lanePosition = getLanePosition(lane);
    const startPosition = getSpawnPosition(currentConfig.scrollDirection);
    const speed = getRandomizedSpeed();
    const axis = isHorizontal ? 'translateX' : 'translateY';
    const pinnedProperty = isHorizontal ? 'top' : 'left';

    const element = document.createElement('div');
    element.className = 'danmu-msg';
    element.innerHTML = escapeHtml(message.text);
    element.style.cssText = `position:absolute;${pinnedProperty}:${lanePosition}px;transform:${axis}(${startPosition}px);font-size:${currentConfig.fontSize}px;font-family:${currentConfig.fontFamily},Arial,sans-serif;font-weight:bold;color:${currentConfig.color};opacity:${currentConfig.opacity};white-space:nowrap;pointer-events:none;user-select:none;padding:4px 8px;text-shadow:${getTextShadow(currentConfig)};will-change:transform;`;
    container.appendChild(element);

    const now = Date.now();
    const nextMessage: OverlayMessage = {
      ...message,
      el: element,
      lane,
      pos: startPosition,
      speed,
      startTime: now,
      size,
    };

    activeRef.current.set(message.id, nextMessage);

    const laneState = lanesRef.current[lane];
    if (laneState) {
      const trailingEdge = isHorizontal
        ? (currentConfig.scrollDirection === 'rtl' ? startPosition + size : startPosition - size)
        : (currentConfig.scrollDirection === 'btt' ? startPosition - size : startPosition + size);

      laneState.lastEdge = trailingEdge;
      laneState.lastTime = now;
      laneState.lastSpeed = speed;
    }
  }, [escapeHtml, getLanePosition, getRandomizedSpeed, getSpawnPosition, getTextShadow, isLaneClear, measureHorizontalText]);

  const spawnTiktokMessage = useCallback((message: OverlayMessage) => {
    const container = tiktokRef.current;
    if (!container) return;

    const currentConfig = configRef.current;
    const element = document.createElement('div');
    element.className = 'tiktok-message';
    const rawText = message.senderName ? message.text.replace(`${message.senderName}: `, '') : message.text;
    const nameMarkup = message.senderName ? `<span class="tiktok-name">${escapeHtml(message.senderName)}</span>` : '';
    element.innerHTML = `${nameMarkup}<span class="tiktok-text">${escapeHtml(rawText)}</span>`;
    element.style.cssText = `font-size:${Math.max(14, currentConfig.fontSize * 0.55)}px;font-family:${currentConfig.fontFamily},Arial,sans-serif;color:${currentConfig.color};opacity:0;transform:translateY(20px);transition:opacity 0.4s ease,transform 0.4s ease;`;
    container.appendChild(element);

    requestAnimationFrame(() => {
      element.style.opacity = String(currentConfig.opacity);
      element.style.transform = 'translateY(0)';
    });

    while (container.children.length > currentConfig.maxMessages) {
      const oldest = container.children[0] as HTMLElement;
      oldest.style.opacity = '0';
      oldest.style.transform = 'translateY(-10px)';
      setTimeout(() => {
        oldest.remove();
      }, 400);
      break;
    }

    activeRef.current.set(message.id, {
      ...message,
      el: element,
      lane: 0,
      pos: 0,
      speed: 0,
      startTime: Date.now(),
      size: 0,
    });

    const lifetime = currentConfig.maxLifetime * 1000;
    setTimeout(() => {
      if (!element.parentNode) return;
      element.style.opacity = '0';
      element.style.transform = 'translateY(-10px)';
      setTimeout(() => {
        element.remove();
        activeRef.current.delete(message.id);
      }, 400);
    }, lifetime);
  }, [escapeHtml]);

  const spawnMessage = useCallback((message: OverlayMessage) => {
    if (configRef.current.scrollType === 'tiktok') {
      spawnTiktokMessage(message);
      return;
    }

    spawnDanmakuMessage(message);
  }, [spawnDanmakuMessage, spawnTiktokMessage]);

  const animationLoop = useCallback(() => {
    if (destroyedRef.current) return;

    const now = Date.now();
    const currentConfig = configRef.current;
    updateDimensions();

    if (currentConfig.scrollType === 'danmaku') {
      const isHorizontal = isHorizontalDirection(currentConfig.scrollDirection);
      const idsToRemove: string[] = [];

      activeRef.current.forEach((message, id) => {
        if (!message.el) {
          idsToRemove.push(id);
          return;
        }

        const elapsed = (now - message.startTime) / 1000;
        let position: number;

        switch (currentConfig.scrollDirection) {
          case 'rtl':
            position = message.pos - elapsed * message.speed;
            break;
          case 'ltr':
            position = message.pos + elapsed * message.speed;
            break;
          case 'ttb':
            position = message.pos + elapsed * message.speed;
            break;
          case 'btt':
            position = message.pos - elapsed * message.speed;
            break;
        }

        message.el.style.transform = `${isHorizontal ? 'translateX' : 'translateY'}(${position}px)`;

        const isOffscreen = (() => {
          switch (currentConfig.scrollDirection) {
            case 'rtl':
              return position < -(message.size + 50);
            case 'ltr':
              return position > widthRef.current + 50;
            case 'ttb':
              return position > heightRef.current + 50;
            case 'btt':
              return position < -(message.size + 50);
          }
        })();

        if (isOffscreen || elapsed >= currentConfig.maxLifetime) {
          idsToRemove.push(id);
        }
      });

      idsToRemove.forEach((id) => {
        activeRef.current.get(id)?.el?.remove();
        activeRef.current.delete(id);
      });
    }

    if (queueRef.current.length > 0 && now - lastSpawnRef.current >= currentConfig.spawnInterval) {
      if (activeRef.current.size < currentConfig.maxMessages) {
        const nextMessage = queueRef.current.shift();
        if (nextMessage) {
          spawnMessage(nextMessage);
          lastSpawnRef.current = now;
        }
      }
    }

    animationRef.current = requestAnimationFrame(animationLoop);
  }, [spawnMessage, updateDimensions]);

  const queueApprovedMessages = useCallback((messages: PublicApprovedMessage[]) => {
    messages.forEach((message) => {
      if (!message.approved_at || message.approved_at < sessionStartRef.current) {
        return;
      }

      if (seenRef.current.has(message.id)) {
        return;
      }

      seenRef.current.add(message.id);
      const text = message.sender_name ? `${message.sender_name}: ${message.text}` : message.text;
      queueRef.current.push({
        id: message.id,
        text,
        senderName: message.sender_name,
        approvedAt: message.approved_at,
        lane: 0,
        pos: 0,
        speed: 0,
        startTime: 0,
        size: 0,
      });
    });
  }, []);

  const loadEvent = useCallback(async (id: string) => {
    try {
      const event = await fetchPublicEvent(id);
      applyConfig(event.overlay_config);
      setLoadError('');

      if (event.overlay_cleared_at && event.overlay_cleared_at !== clearedAtRef.current) {
        clearedAtRef.current = event.overlay_cleared_at;
        sinceRef.current = event.overlay_cleared_at;
        clearOverlayState(true);
      }
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Gagal memuat overlay');
    } finally {
      setEventLoading(false);
    }
  }, [applyConfig, clearOverlayState]);

  const loadMessages = useCallback(async (id: string) => {
    try {
      const response = await fetchPublicMessages(id, sinceRef.current || sessionStartRef.current);

      if (response.clearedAt && response.clearedAt !== clearedAtRef.current) {
        clearedAtRef.current = response.clearedAt;
        sinceRef.current = response.clearedAt;
        clearOverlayState(true);
      }

      queueApprovedMessages(response.messages);
      if (response.nextSince) {
        sinceRef.current = response.nextSince;
      }
    } catch {
      // Ignore polling blips and keep trying on the next interval.
    }
  }, [clearOverlayState, queueApprovedMessages]);

  useEffect(() => {
    if (!eventId) {
      setEventLoading(false);
      setLoadError('Tambahkan eventId pada URL overlay.');
      return;
    }

    destroyedRef.current = false;
    sessionStartRef.current = new Date().toISOString();
    sinceRef.current = sessionStartRef.current;
    clearedAtRef.current = null;
    updateDimensions();
    lanesRef.current = createOverlayLaneState(configRef.current.laneCount);
    clearOverlayState(true);

    void loadEvent(eventId);
    void loadMessages(eventId);
    animationRef.current = requestAnimationFrame(animationLoop);

    const messageInterval = setInterval(() => {
      void loadMessages(eventId);
    }, 1200);
    const eventInterval = setInterval(() => {
      void loadEvent(eventId);
    }, 2500);

    const resizeObserver = new ResizeObserver(updateDimensions);
    if (danmakuRef.current) {
      resizeObserver.observe(danmakuRef.current);
    }

    return () => {
      destroyedRef.current = true;
      cancelAnimationFrame(animationRef.current);
      clearInterval(messageInterval);
      clearInterval(eventInterval);
      resizeObserver.disconnect();
      clearOverlayState(true);
    };
  }, [animationLoop, clearOverlayState, eventId, loadEvent, loadMessages, updateDimensions]);

  if (!eventId) {
    if (obsMode) {
      return <div style={{ position: 'fixed', inset: 0, background: 'transparent' }} />;
    }

    return (
      <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#1a1a2e,#16213e)', color: '#fff', fontFamily: 'Arial,sans-serif', fontSize: 24, textAlign: 'center', padding: 40 }}>
        <div style={{ fontSize: 48, marginBottom: 20 }}>🎬</div>
        <div>No eventId provided</div>
        <div style={{ fontSize: 16, opacity: 0.7, marginTop: 10 }}>Add <code style={{ background: 'rgba(255,255,255,.1)', padding: '4px 8px', borderRadius: 4 }}>?eventId=YOUR_EVENT_ID</code></div>
      </div>
    );
  }

  if (eventLoading && !loadError) {
    return <div style={{ position: 'fixed', inset: 0, background: 'transparent' }} />;
  }

  if (loadError) {
    if (obsMode) {
      return <div style={{ position: 'fixed', inset: 0, background: 'transparent' }} />;
    }

    return (
      <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#1a1a2e,#16213e)', color: '#fff', fontFamily: 'Arial,sans-serif', textAlign: 'center', padding: 40 }}>
        <div>
          <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
          <div style={{ fontSize: 20, marginBottom: 8 }}>Overlay tidak dapat dimuat</div>
          <div style={{ opacity: 0.8 }}>{loadError}</div>
        </div>
      </div>
    );
  }

  const background = config.bgOpacity > 0 ? hexToRgba(config.bgColor, config.bgOpacity) : 'transparent';

  return (
    <>
      <div
        ref={danmakuRef}
        className="overlay-container"
        style={{
          position: 'fixed',
          inset: 0,
          overflow: 'hidden',
          pointerEvents: 'none',
          ['--overlay-bg' as string]: background,
        }}
      />
      <div
        ref={tiktokRef}
        className="tiktok-feed"
        style={{
          position: 'fixed',
          bottom: 40,
          left: 24,
          width: 400,
          maxHeight: '65vh',
          display: config.scrollType === 'tiktok' ? 'flex' : 'none',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          gap: 8,
          pointerEvents: 'none',
          overflow: 'hidden',
          ['--overlay-bg' as string]: background,
        }}
      />
    </>
  );
}

export default function OverlayPage() {
  return (
    <Suspense fallback={<div style={{ position: 'fixed', inset: 0, background: 'transparent' }} />}>
      <OverlayContent />
    </Suspense>
  );
}
