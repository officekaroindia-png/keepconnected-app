import { useEffect, useState } from 'react';

// Live clock that ticks on the second boundary (no drift, no wasted renders).
export function useClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    let id;
    const tick = () => {
      setNow(new Date());
      id = setTimeout(tick, 1000 - (Date.now() % 1000));
    };
    id = setTimeout(tick, 1000 - (Date.now() % 1000));
    return () => clearTimeout(id);
  }, []);
  return now;
}
