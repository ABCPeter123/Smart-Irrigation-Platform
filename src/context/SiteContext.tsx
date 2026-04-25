import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  BackendSite,
  CreateBackendSitePayload,
  createBackendSite,
  deleteBackendSite,
  fetchBackendSites,
  updateBackendSite,
} from "../services/api";
import { Site } from "../types";

type NewSiteInput = Omit<Site, "id"> & { id?: string };
type UpdateSiteInput = Partial<Omit<Site, "id">>;

type SiteContextValue = {
  sites: Site[];
  selectedSiteId: string;
  selectedSite: Site | null;
  loadingSites: boolean;
  sitesError: string | null;
  refreshSites: () => Promise<void>;
  setSelectedSiteId: (id: string) => void;
  addCustomSite: (site: NewSiteInput) => Promise<void>;
  updateSite: (id: string, updates: UpdateSiteInput) => Promise<void>;
  removeSite: (id: string) => Promise<void>;
  isDefaultSite: (id: string) => boolean;
};

const SiteContext = createContext<SiteContextValue | undefined>(undefined);

function backendSiteToSite(site: BackendSite): Site {
  return {
    id: site.id,
    name: site.name,
    locationLabel: site.locationLabel,
    latitude: site.latitude,
    longitude: site.longitude,
    areaHa: site.areaHa,
    cropType: site.cropType as Site["cropType"],
    environment: site.environment as Site["environment"],
    irrigationMethod: site.irrigationMethod as Site["irrigationMethod"],
    soilType: site.soilType as Site["soilType"],
    connectedProbes: site.connectedProbes,
  };
}

function siteToCreatePayload(site: NewSiteInput): CreateBackendSitePayload {
  return {
    name: site.name,
    locationLabel: site.locationLabel,
    latitude: site.latitude,
    longitude: site.longitude,
    areaHa: site.areaHa,
    cropType: site.cropType,
    environment: site.environment,
    irrigationMethod: site.irrigationMethod,
    soilType: site.soilType,
    connectedProbes: site.connectedProbes ?? 0,
  };
}

function siteUpdatesToPayload(
  updates: UpdateSiteInput
): Partial<CreateBackendSitePayload> {
  return {
    ...(updates.name !== undefined ? { name: updates.name } : {}),
    ...(updates.locationLabel !== undefined
      ? { locationLabel: updates.locationLabel }
      : {}),
    ...(updates.latitude !== undefined ? { latitude: updates.latitude } : {}),
    ...(updates.longitude !== undefined ? { longitude: updates.longitude } : {}),
    ...(updates.areaHa !== undefined ? { areaHa: updates.areaHa } : {}),
    ...(updates.cropType !== undefined ? { cropType: updates.cropType } : {}),
    ...(updates.environment !== undefined
      ? { environment: updates.environment }
      : {}),
    ...(updates.irrigationMethod !== undefined
      ? { irrigationMethod: updates.irrigationMethod }
      : {}),
    ...(updates.soilType !== undefined ? { soilType: updates.soilType } : {}),
    ...(updates.connectedProbes !== undefined
      ? { connectedProbes: updates.connectedProbes }
      : {}),
  };
}

export function SiteProvider({ children }: { children: React.ReactNode }) {
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string>("");
  const [loadingSites, setLoadingSites] = useState(true);
  const [sitesError, setSitesError] = useState<string | null>(null);

  const refreshSites = useCallback(async () => {
    try {
      setLoadingSites(true);
      setSitesError(null);

      const backendSites = await fetchBackendSites();
      const mappedSites = backendSites.map(backendSiteToSite);

      setSites(mappedSites);

      setSelectedSiteId((currentId) => {
        if (mappedSites.some((site) => site.id === currentId)) {
          return currentId;
        }

        return mappedSites[0]?.id ?? "";
      });
    } catch (error) {
      setSitesError(
        error instanceof Error ? error.message : "Unable to load backend sites."
      );
    } finally {
      setLoadingSites(false);
    }
  }, []);

  useEffect(() => {
    refreshSites();
  }, [refreshSites]);

  const selectedSite = useMemo(() => {
    return sites.find((site) => site.id === selectedSiteId) ?? sites[0] ?? null;
  }, [sites, selectedSiteId]);

  const isDefaultSite = (_id: string) => {
    return false;
  };

  const addCustomSite = async (site: NewSiteInput) => {
    const created = await createBackendSite(siteToCreatePayload(site));
    const mapped = backendSiteToSite(created);

    setSites((prev) => {
      const withoutDuplicate = prev.filter(
        (existing) => existing.id !== mapped.id
      );
      return [...withoutDuplicate, mapped];
    });

    setSelectedSiteId(mapped.id);
  };

  const updateSite = async (id: string, updates: UpdateSiteInput) => {
    const updated = await updateBackendSite(id, siteUpdatesToPayload(updates));
    const mapped = backendSiteToSite(updated);

    setSites((prev) =>
      prev.map((site) => {
        if (site.id === id) {
          return mapped;
        }

        return site;
      })
    );
  };

  const removeSite = async (id: string) => {
    await deleteBackendSite(id);

    setSites((prev) => {
      const nextSites = prev.filter((site) => site.id !== id);

      setSelectedSiteId((currentSelectedId) => {
        if (currentSelectedId !== id) {
          return currentSelectedId;
        }

        return nextSites[0]?.id ?? "";
      });

      return nextSites;
    });
  };

  return (
    <SiteContext.Provider
      value={{
        sites,
        selectedSiteId,
        selectedSite,
        loadingSites,
        sitesError,
        refreshSites,
        setSelectedSiteId,
        addCustomSite,
        updateSite,
        removeSite,
        isDefaultSite,
      }}
    >
      {children}
    </SiteContext.Provider>
  );
}

export function useSiteContext() {
  const context = useContext(SiteContext);

  if (!context) {
    throw new Error("useSiteContext must be used inside a SiteProvider");
  }

  return context;
}