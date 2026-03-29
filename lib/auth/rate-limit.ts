const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

type AttemptState = {
  count: number;
  resetAt: number;
};

const attempts = new Map<string, AttemptState>();

function getCurrentState(key: string, now: number) {
  const state = attempts.get(key);
  if (!state || state.resetAt <= now) {
    return { count: 0, resetAt: now + ATTEMPT_WINDOW_MS };
  }
  return state;
}

export function checkLoginRateLimit(key: string) {
  const now = Date.now();
  const state = getCurrentState(key, now);

  if (state.count >= MAX_ATTEMPTS) {
    attempts.set(key, state);
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((state.resetAt - now) / 1000),
    };
  }

  attempts.set(key, {
    count: state.count + 1,
    resetAt: state.resetAt,
  });

  return { allowed: true, retryAfterSeconds: 0 };
}

export function clearLoginRateLimit(key: string) {
  attempts.delete(key);
}
