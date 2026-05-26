"use client";

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

interface SelectedCourtContextValue {
  selectedCourtId: string | null;
  setSelectedCourtId: (id: string) => void;
}

const SelectedCourtContext = createContext<SelectedCourtContextValue>({
  selectedCourtId: null,
  setSelectedCourtId: () => {},
});

function storageKey(uid: string): string {
  return `operator_selected_court_${uid}`;
}

// Provider lives inside the operator dashboard layout. `uid` and `courtIds`
// are the source of truth — the context falls back to the first courtId if
// the stored selection isn't in the operator's portfolio anymore.
export function SelectedCourtProvider({
  uid,
  courtIds,
  children,
}: {
  uid: string;
  courtIds: string[];
  children: ReactNode;
}) {
  const [selectedCourtId, setSelectedCourtIdState] = useState<string | null>(null);

  // Pick an initial selection: stored value if still valid, else the first court.
  useEffect(() => {
    if (courtIds.length === 0) {
      setSelectedCourtIdState(null);
      return;
    }
    let next: string | null = null;
    try {
      const stored = typeof window !== "undefined" ? localStorage.getItem(storageKey(uid)) : null;
      if (stored && courtIds.includes(stored)) {
        next = stored;
      }
    } catch {
      // ignore
    }
    setSelectedCourtIdState(next ?? courtIds[0]);
  }, [uid, courtIds]);

  const setSelectedCourtId = useCallback(
    (id: string) => {
      setSelectedCourtIdState(id);
      try {
        if (typeof window !== "undefined") {
          localStorage.setItem(storageKey(uid), id);
        }
      } catch {
        // ignore
      }
    },
    [uid]
  );

  const value = useMemo(
    () => ({ selectedCourtId, setSelectedCourtId }),
    [selectedCourtId, setSelectedCourtId]
  );

  return (
    <SelectedCourtContext.Provider value={value}>{children}</SelectedCourtContext.Provider>
  );
}

export function useSelectedCourt(): string | null {
  return useContext(SelectedCourtContext).selectedCourtId;
}

export function useSelectedCourtSetter(): (id: string) => void {
  return useContext(SelectedCourtContext).setSelectedCourtId;
}
