export type OverlayRuntimeMode = 'booting' | 'live' | 'reconnecting' | 'catching_up';

type CursorLikeMessage = {
  id: string;
  approved_at: string | null;
};

export type OverlayDeliveryState = {
  mode: OverlayRuntimeMode;
  catchUpBacklog: number;
};

export function createOverlayDeliveryState(): OverlayDeliveryState {
  return {
    mode: 'booting',
    catchUpBacklog: 0,
  };
}

export function reducePollStatus(
  state: OverlayDeliveryState,
  event: { type: 'poll-succeeded' } | { type: 'poll-failed' },
): OverlayDeliveryState {
  if (event.type === 'poll-failed') {
    return {
      ...state,
      mode: 'reconnecting',
    };
  }

  return state.mode === 'booting' || state.mode === 'reconnecting'
    ? { ...state, mode: 'live' }
    : state;
}

export function mergeIncomingMessages(
  state: OverlayDeliveryState,
  messages: CursorLikeMessage[],
): OverlayDeliveryState {
  if (state.mode === 'reconnecting' && messages.length > 0) {
    return {
      mode: 'catching_up',
      catchUpBacklog: messages.length,
    };
  }

  if (messages.length === 0 && state.catchUpBacklog === 0) {
    return {
      ...state,
      mode: state.mode === 'booting' ? 'live' : state.mode,
    };
  }

  return {
    ...state,
    mode: state.mode === 'booting' ? 'live' : state.mode,
    catchUpBacklog: state.catchUpBacklog + messages.length,
  };
}

export function getCatchUpSpawnInterval(spawnInterval: number) {
  return Math.max(spawnInterval, 1600);
}

export function resetOverlayDeliveryState(): OverlayDeliveryState {
  return createOverlayDeliveryState();
}

export function completeCatchUpDrain(state: OverlayDeliveryState): OverlayDeliveryState {
  const nextBacklog = Math.max(0, state.catchUpBacklog - 1);

  return {
    mode: nextBacklog > 0 ? 'catching_up' : 'live',
    catchUpBacklog: nextBacklog,
  };
}
