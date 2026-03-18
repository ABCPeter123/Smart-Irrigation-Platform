import React, { createContext, useContext, useMemo, useState } from "react";
import { SITES as DEFAULT_SITES } from "../data/sites";
import { Site } from "../types";

type NewSiteInput = Omit<Site, "id"> & { id?: string };

type SiteContextValue = {
  sites: Site[];
  selectedSiteId: string;
  selectedSite: Site;
  setSelectedSiteId: (id: string) => void;
  addCustomSite: (site: NewSiteInput) => void;
  removeSite: (id: string) => void;
  isDefaultSite: (id: string) => boolean;
};

const SiteContext = createContext<SiteContextValue | undefined>(undefined);

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function SiteProvider({ children }: { children: React.ReactNode }) {
  const [customSites, setCustomSites] = useState<Site[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string>(DEFAULT_SITES[0].id);

  const sites = useMemo(() => {
    return [...DEFAULT_SITES, ...customSites];
  }, [customSites]);

  const selectedSite =
    sites.find((site) => site.id === selectedSiteId) ?? sites[0];

  const isDefaultSite = (id: string) => {
    return DEFAULT_SITES.some((site) => site.id === id);
  };

  const addCustomSite = (site: NewSiteInput) => {
    const generatedId =
      site.id && site.id.length > 0
        ? site.id
        : `${slugify(site.name)}-${Date.now()}`;

    const finalSite: Site = {
      ...site,
      id: generatedId,
    };

    setCustomSites((prev) => [...prev, finalSite]);
    setSelectedSiteId(finalSite.id);
  };

  const removeSite = (id: string) => {
    if (isDefaultSite(id)) {
      return;
    }

    setCustomSites((prev) => {
      const nextCustomSites = prev.filter((site) => site.id !== id);

      setSelectedSiteId((currentSelectedId) => {
        if (currentSelectedId !== id) {
          return currentSelectedId;
        }

        const nextSites = [...DEFAULT_SITES, ...nextCustomSites];
        return nextSites[0]?.id ?? DEFAULT_SITES[0].id;
      });

      return nextCustomSites;
    });
  };

  return (
    <SiteContext.Provider
      value={{
        sites,
        selectedSiteId,
        selectedSite,
        setSelectedSiteId,
        addCustomSite,
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