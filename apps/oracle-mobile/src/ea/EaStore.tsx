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
import { usePortalSession } from '../access/portalSession';
import { fetchCloudPrimary, pushEaToCloud } from '../cloud/oracleCloud';
import { filterEasForMentor, type ExpertAdvisor } from './types';

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
  }) => Promise<ExpertAdvisor>;
  updateEaImage: (id: string, imageUri: string | null) => Promise<void>;
  getEaById: (id: string) => ExpertAdvisor | null;
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

function preferImage(a: string | null | undefined, b: string | null | undefined): string | null {
  const A = typeof a === 'string' && a.trim() ? a.trim() : null;
  const B = typeof b === 'string' && b.trim() ? b.trim() : null;
  if (A && B) {
    if (/^https?:\/\//i.test(A)) return A;
    if (/^https?:\/\//i.test(B)) return B;
    // Prefer the richer upload (avoids a stale 1×1 placeholder beating a real photo)
    return A.length >= B.length ? A : B;
  }
  return A || B;
}

function mergeEaLists(a: ExpertAdvisor[], b: ExpertAdvisor[]): ExpertAdvisor[] {
  const map = new Map<string, ExpertAdvisor>();
  for (const e of [...b, ...a]) {
    if (!e?.id || e.id === LEGACY_DEFAULT_ID) continue;
    const prev = map.get(e.id);
    if (!prev) {
      map.set(e.id, e);
      continue;
    }
    // Prefer newer metadata, but never drop a real uploaded image for null / tiny stub
    const newer = (e.createdAt || '') >= (prev.createdAt || '') ? e : prev;
    const older = newer === e ? prev : e;
    map.set(e.id, {
      ...newer,
      imageUri: preferImage(newer.imageUri, older.imageUri),
      name: newer.name || older.name,
      mentorId: newer.mentorId || older.mentorId || 'legacy',
    });
  }
  return Array.from(map.values());
}

export function EaProvider({ children }: { children: ReactNode }) {
  const { scopeMentorId, session } = usePortalSession();
  const [easAll, setEas] = useState<ExpertAdvisor[]>(() => loadEas());
  const eas = useMemo(
    () => filterEasForMentor(easAll, scopeMentorId),
    [easAll, scopeMentorId],
  );
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
    persist(easAll, selectedId);
  }, [easAll, selectedId]);

  useEffect(() => {
    let cancelled = false;
    const pull = async () => {
      try {
        const store = await fetchCloudPrimary();
        if (cancelled) return;
        setEas((prev) =>
          mergeEaLists(
            store.eas.map((e) => ({
              ...e,
              mentorId: e.mentorId || 'legacy',
            })),
            prev,
          ),
        );
      } catch {
        /* keep local */
      }
    };
    void pull();
    const id = setInterval(() => {
      void pull();
    }, 60000);
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
    async (input: {
      name: string;
      imageUri: string | null;
      type: 'Standard' | 'Self-host';
    }) => {
      const mentorId = session?.mentorId || scopeMentorId || 'legacy';
      const entry: ExpertAdvisor = {
        id: `ea-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: input.name.trim(),
        imageUri: input.imageUri,
        type: input.type,
        createdAt: new Date().toISOString(),
        mentorId,
      };
      setEas((prev) => [entry, ...prev]);
      setSelectedId(entry.id);
      try {
        const store = await pushEaToCloud(entry);
        const cloudEa = store.eas.find((e) => e.id === entry.id);
        if (cloudEa) {
          const synced = {
            ...entry,
            imageUri: cloudEa.imageUri || entry.imageUri,
            name: cloudEa.name || entry.name,
            mentorId: cloudEa.mentorId || entry.mentorId,
          };
          setEas((prev) => mergeEaLists([synced], prev));
          return synced;
        }
      } catch {
        /* local kept; cloud may lag */
      }
      return entry;
    },
    [session?.mentorId, scopeMentorId],
  );

  const updateEaImage = useCallback(
    async (id: string, imageUri: string | null) => {
      const current = easAll.find((e) => e.id === id);
      if (scopeMentorId && current && (current.mentorId || 'legacy') !== scopeMentorId) {
        throw new Error('You cannot edit another mentor’s EA.');
      }
      const updated: ExpertAdvisor = current
        ? { ...current, imageUri, createdAt: new Date().toISOString() }
        : {
            id,
            name: 'EA',
            imageUri,
            type: 'Standard',
            createdAt: new Date().toISOString(),
            mentorId: session?.mentorId || scopeMentorId || 'legacy',
          };
      setEas((prev) => prev.map((e) => (e.id === id ? { ...e, imageUri } : e)));
      setSelectedId(id);
      const store = await pushEaToCloud(updated);
      const cloudEa = store.eas.find((e) => e.id === id);
      const persisted = cloudEa?.imageUri || imageUri;
      setEas((prev) =>
        prev.map((e) =>
          e.id === id
            ? {
                ...e,
                imageUri: persisted,
                name: cloudEa?.name || e.name,
                mentorId: cloudEa?.mentorId || e.mentorId,
              }
            : e,
        ),
      );
    },
    [easAll, scopeMentorId, session?.mentorId],
  );

  const getEaById = useCallback(
    (id: string) => easAll.find((e) => e.id === id) ?? null,
    [easAll],
  );

  const removeEa = useCallback(
    (id: string) => {
      const target = easAll.find((e) => e.id === id);
      if (scopeMentorId && target && (target.mentorId || 'legacy') !== scopeMentorId) {
        return;
      }
      setEas((prev) => {
        const next = prev.filter((e) => e.id !== id);
        setSelectedId((cur) => (cur === id ? next[0]?.id ?? null : cur));
        return next;
      });
    },
    [easAll, scopeMentorId],
  );

  const selectEa = useCallback((id: string) => {
    setSelectedId(id);
  }, []);

  const value = useMemo(
    () => ({ eas, selectedId, selected, addEa, updateEaImage, removeEa, selectEa, getEaById }),
    [eas, selectedId, selected, addEa, updateEaImage, removeEa, selectEa, getEaById],
  );

  return <EaContext.Provider value={value}>{children}</EaContext.Provider>;
}

export function useEas(): EaContextValue {
  const ctx = useContext(EaContext);
  if (!ctx) throw new Error('useEas must be used within EaProvider');
  return ctx;
}
