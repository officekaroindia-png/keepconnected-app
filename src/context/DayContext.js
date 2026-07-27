import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getToday } from '../api/day';

// Holds today's state + the Actions sheet, so the Actions TAB can open the sheet.
const DayCtx = createContext(null);
export const useDay = () => useContext(DayCtx);

export function DayProvider({ children }) {
  const [day, setDay] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);

  const reload = useCallback(async () => {
    try { setDay(await getToday()); } catch {} finally { setLoading(false); }
  }, []);
  useEffect(() => { reload(); }, [reload]);

  const openSheet = useCallback(() => setSheetOpen(true), []);
  const closeSheet = useCallback(() => setSheetOpen(false), []);

  return (
    <DayCtx.Provider value={{ day, loading, reload, sheetOpen, openSheet, closeSheet }}>
      {children}
    </DayCtx.Provider>
  );
}
