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
import { fetchCloudStore, pushEaToCloud } from '../cloud/oracleCloud';
import type { ExpertAdvisor } from './types';

const STORAGE_KEY = 'oracle.eas.v1';
const SELECTED_KEY = 'oracle.eas.selected.v1';
/** Legacy seeded default — strip on load so the catalog starts empty. */
const LEGACY_DEFAULT_ID = 'default-the-oracle';

type EaContextValue = {
  /** Admin catalog — empty until EAs are created in the portal. */
  eas: ExpertAdvisor[];
  selectedId: string | null;
  selected: ExpertAdvisor | null;
  addEa: (input: {
    name: string;
    imageUri: string | null;
    type: 'Standard' | 'Self-host';
  }) => ExpertAdvisor;
  updateEaImage: (id: string, imageUri: string | null) => void;
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
    return parsed.filter(
      (e) =>
        e &&
        typeof e.id === 'string' &&
        typeof e.name === 'string' &&
        e.id !== LEGACY_DEFAULT_ID &&
        !(e as { isDefault?: boolean }).isDefault,
    );
  } catch {
    return [];
  }
}

function loadSelectedId(eas: ExpertAdvisor[]): string | null {
  if (eas.length === 0) return null;
  if (Platform.OS !== 'web' || typeof localStorage === 'undefined') {
    return eas[0]?.id ?? null;
  }
  try {
    const id = localStorage.getItem(SELECTED_KEY);
    if (id && eas.some((e) => e.id === id)) return id;
  } catch {
    /* ignore */
  }
  return eas[0]?.id ?? null;
}

function persist(eas: ExpertAdvisor[], selectedId: string | null) {
  if (Platform.OS !== 'web' || typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(eas));
    if (selectedId) localStorage.setItem(SELECTED_KEY, selectedId);
    else localStorage.removeItem(SELECTED_KEY);
  } catch {
    /* quota / private mode */
  }
}

function mergeEaLists(a: ExpertAdvisor[], b: ExpertAdvisor[]): ExpertAdvisor[] {
  const map = new Map<string, ExpertAdvisor>();
  for (const e of [...b, ...a]) {
    if (!e?.id || e.id === LEGACY_DEFAULT_ID) continue;
    const prev = map.get(e.id);
    if (!prev || (e.createdAt || '') >= (prev.createdAt || '')) map.set(e.id, e);
    else if (prev && !prev.imageUri && e.imageUri) map.set(e.id, { ...prev, imageUri: e.imageUri });
  }
  return Array.from(map.values());
}

export function EaProvider({ children }: { children: ReactNode }) {
  const [eas, setEas] = useState<ExpertAdvisor[]>(() => loadEas());
  const [selectedId, setSelectedId] = useState<string | null>(() => loadSelectedId(loadEas()));

  useEffect(() => {
    if (eas.length === 0) {
      if (selectedId !== null) setSelectedId(null);
      return;
    }
    if (!eas.some((e) => e.id === selectedId)) {
      setSelectedId(eas[0].id);
    }
  }, [eas, selectedId]);

  useEffect(() => {
    persist(eas, selectedId);
  }, [eas, selectedId]);

  useEffect(() => {
    let cancelled = false;
    const pull = async () => {
      try {
        const store = await fetchCloudStore();
        if (cancelled) return;
        setEas((prev) => mergeEaLists(store.eas, prev));
      } catch {
        /* keep local */
      }
    };
    void pull();
    const id = setInterval(() => {
      void pull();
    }, 20000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const selected = useMemo(() => {
    if (!selectedId) return null;
    return eas.find((e) => e.id === selectedId) ?? eas[0] ?? null;
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
      setEas((prev) => [entry, ...prev]);
      setSelectedId(entry.id);
      void pushEaToCloud(entry);
      return entry;
    },
    [],
  );

  const updateEaImage = useCallback((id: string, imageUri: string | null) => {
    setEas((prev) => {
      const next = prev.map((e) => (e.id === id ? { ...e, imageUri } : e));
      const updated = next.find((e) => e.id === id);
      if (updated) void pushEaToCloud(updated);
      return next;
    });
    setSelectedId(id);
  }, []);

  const removeEa = useCallback((id: string) => {
    setEas((prev) => {
      const next = prev.filter((e) => e.id !== id);
      setSelectedId((cur) => (cur === id ? next[0]?.id ?? null : cur));
      return next;
    });
  }, []);

  const selectEa = useCallback((id: string) => {
    setSelectedId(id);
  }, []);

  const value = useMemo(
    () => ({ eas, selectedId, selected, addEa, updateEaImage, removeEa, selectEa }),
    [eas, selectedId, selected, addEa, updateEaImage, removeEa, selectEa],
  );

  return <EaContext.Provider value={value}>{children}</EaContext.Provider>;
}

export function useEas(): EaContextValue {
  const ctx = useContext(EaContext);
  if (!ctx) throw new Error('useEas must be used within EaProvider');
  return ctx;
}
