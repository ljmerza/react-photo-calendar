import { useEffect, useState } from 'react';
import { getLocalToday } from '../utils/calendar';

function readLocalTodayIso(): string {
  return getLocalToday().toISOString().slice(0, 10);
}

function msUntilNextLocalMidnight(): number {
  const now = new Date();
  const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return nextMidnight.getTime() - now.getTime();
}

/**
 * The viewer's local date (yyyy-mm-dd), kept current while the page stays open.
 * A timer flips it at local midnight. It is also re-read whenever the page
 * becomes visible again, because a timer can fire late after the machine
 * sleeps through midnight.
 */
export function useLocalTodayIso(): string {
  const [todayIso, setTodayIso] = useState(readLocalTodayIso);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const refresh = () => {
      setTodayIso(readLocalTodayIso());
      clearTimeout(timer);
      timer = setTimeout(refresh, msUntilNextLocalMidnight());
    };

    refresh();
    document.addEventListener('visibilitychange', refresh);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);

  return todayIso;
}
