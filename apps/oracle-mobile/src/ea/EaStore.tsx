import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Platform } from 'react-native';
import {
  createDefaultOracle,
  DEFAULT_ORACLE_ID,
  type ExpertAdvisor,
} from './types';

const STORAGE_KEY = 'oracle.eas.v1';
const SELECTED_KEY = 'oracle.eas.selected.v1';

type EaContextValue = {
  eas: ExpertAdvisor[];
  selectedId: string;
  selected: ExpertAdvisor;
  addEa: (input: {
    name: string;
    imageUri: string | null;
    type: 'Standard' | 'Self-host';
  }) => ExpertAdvisor;
  removeEa: (id: string) => void;
  selectEa: (id: string) => void;
};

const EaContext = createContext<EaContextValue | null>(null);

function loadEas(): ExpertAdvisor[] {
  if (Platform.OS !== 'web' || typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ExpertAdvisor[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((e) => e && typeof e.id === 'string' && typeof e.name === 'string');
  } catch {
    return [];
  }
}

function loadSelectedId(eas: ExpertAdvisor[]): string {
  if (Platform.OS !== 'web' || typeof localStorage === 'undefined') {
    return eas[0]?.id ?? DEFAULT_ORACLE_ID;
  }
  try {
    const id = localStorage.getItem(SELECTED_KEY);
    if (id && eas.some((e) => e.id === id)) return id;
  } catch {
    /* ignore */
  }
  return eas[0]?.id ?? DEFAULT_ORACLE_ID;
}

function persist(eas: ExpertAdvisor[], selectedId: string) {
  if (Platform.OS !== 'web' || typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(eas));
    localStorage.setItem(SELECTED_KEY, selectedId);
  } catch {
    /* quota / private mode */
  }
}

/** Visible list: user EAs, or default THE ORACLE when none yet. */
function visibleEas(userEas: ExpertAdvisor[]): ExpertAdvisor[] {
  if (userEas.length === 0) return [createDefaultOracle()];
  return userEas;
}

export function EaProvider({ children }: { children: ReactNode }) {
  const [userEas, setUserEas] = useState<ExpertAdvisor[]>(() => loadEas());
  const [selectedId, setSelectedId] = useState(() => loadSelectedId(loadEas()));

  const eas = useMemo(() => visibleEas(userEas), [userEas]);

  useEffect(() => {
    const list = visibleEas(userEas);
    if (!list.some((e) => e.id === selectedId)) {
      setSelectedId(list[0].id);
    }
  }, [userEas, selectedId]);

  useEffect(() => {
    persist(userEas, selectedId);
  }, [userEas, selectedId]);

  const selected = useMemo(() => {
    return eas.find((e) => e.id === selectedId) ?? eas[0];
  }, [eas, selectedId]);

  const addEa = useCallback(
    (input: { name: string; imageUri: string | null; type: 'Standard' | 'Self-host' }) => {
      const entry: ExpertAdvisor = {
        id: `ea-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: input.name.trim(),
        imageUri: input.imageUri,
        type: input.type,
        createdAt: new Date().toISOString(),
      };
      setUserEas((prev) => [entry, ...prev]);
      setSelectedId(entry.id);
      return entry;
    },
    [],
  );

  const removeEa = useCallback((id: string) => {
    if (id === DEFAULT_ORACLE_ID) return;
    setUserEas((prev) => {
      const next = prev.filter((e) => e.id !== id);
      const visible = visibleEas(next);
      setSelectedId((cur) => (cur === id ? visible[0].id : cur));
      return next;
    });
  }, []);

  const selectEa = useCallback((id: string) => {
    setSelectedId(id);
  }, []);

  const value = useMemo(
    () => ({ eas, selectedId, selected, addEa, removeEa, selectEa }),
    [eas, selectedId, selected, addEa, removeEa, selectEa],
  );

  return <EaContext.Provider value={value}>{children}</EaContext.Provider>;
}

export function useEas(): EaContextValue {
  const ctx = useContext(EaContext);
  if (!ctx) throw new Error('useEas must be used within EaProvider');
  return ctx;
}
