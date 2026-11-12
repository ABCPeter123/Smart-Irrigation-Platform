import React, { useEffect, useRef, useState } from "react";
import type { DemoField } from "../services/irrigationScenario.web";
import { searchPlaces, type SearchPlace } from "../services/locationSearch.web";

export function LocationPicker({
  selected,
  presets,
  onSelect,
  onChooseLocation,
}: {
  selected: DemoField;
  presets: DemoField[];
  onSelect: (field: DemoField) => void;
  onChooseLocation: (place: SearchPlace) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchPlace[]>([]);
  const [status, setStatus] = useState<"idle" | "searching" | "empty" | "results">("idle");
  const [error, setError] = useState<string | null>(null);
  const container = useRef<HTMLDivElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const controllerRef = useRef<AbortController | null>(null);

  function close() {
    controllerRef.current?.abort();
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    searchInput.current?.focus();
    const outside = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) close();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
        container.current?.querySelector<HTMLButtonElement>(".ir-farm-trigger")?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  useEffect(() => () => controllerRef.current?.abort(), []);

  async function runSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setStatus("searching");
    setResults([]);
    setError(null);
    try {
      const matches = await searchPlaces(query, controller.signal);
      if (controller.signal.aborted) return;
      setResults(matches);
      setStatus(matches.length ? "results" : "empty");
    } catch (cause) {
      if (controller.signal.aborted) return;
      setStatus("empty");
      setError(cause instanceof Error ? cause.message : "Place search is unavailable.");
    }
  }

  function choose(place: SearchPlace) {
    onChooseLocation(place);
    setQuery("");
    setResults([]);
    setStatus("idle");
    setError(null);
    close();
  }

  return (
    <div className="ir-farm-picker ir-location-picker" ref={container}>
      <button className="ir-farm-trigger" type="button" aria-expanded={open}
        aria-controls="ir-location-menu" onClick={() => open ? close() : setOpen(true)}>
        <svg className="ir-pin-icon" width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M19 10c0 5.2-7 11-7 11S5 15.2 5 10a7 7 0 1 1 14 0Z" stroke="currentColor" strokeWidth="1.8"/>
          <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.8"/>
        </svg>
        <span className="ir-farm-trigger-label">{selected.name}</span>
        <svg className="ir-chevron" width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      {open ? (
        <div className="ir-farm-menu ir-location-menu" id="ir-location-menu">
          <div className="ir-location-menu-heading">FIND ANY LOCATION</div>
          <form className="ir-location-search" onSubmit={runSearch} role="search">
            <label className="ir-visually-hidden" htmlFor="ir-place-search">Search a place, address, or coordinates</label>
            <input id="ir-place-search" ref={searchInput} value={query}
              onChange={event => { setQuery(event.target.value); setError(null); }}
              placeholder="City, address, or lat, lon" maxLength={120}
              autoComplete="off" spellCheck={false}/>
            <button type="submit" disabled={status === "searching"}>{status === "searching" ? "..." : "Search"}</button>
          </form>
          <p className="ir-place-hint">Enter an address or coordinates, e.g. 43.4516, -80.4925</p>
          {error && <p className="ir-place-error" role="alert">{error}</p>}
          {status === "empty" && !error && <p className="ir-place-empty">No places found. Try a nearby town or precise coordinates.</p>}
          {results.length > 0 && (
            <div className="ir-location-results" aria-label="Location search results">
              <div className="ir-farm-menu-heading">SEARCH RESULTS</div>
              {results.map(place => (
                <button type="button" key={place.id + place.latitude} className="ir-farm-option ir-place-result" onClick={() => choose(place)}>
                  <span className="ir-option-text"><strong>{place.label}</strong>
                    <small>{place.latitude.toFixed(4)}°, {place.longitude.toFixed(4)}°</small></span>
                </button>
              ))}
            </div>
          )}
          <div className="ir-location-presets">
            <span className="ir-farm-menu-heading">DEMO FIELDS</span>
            {selected.id.startsWith("custom-") && (
              <button type="button" className="ir-farm-option is-selected" onClick={close}>
                <span className="ir-option-text"><strong>{selected.name}</strong><small>{selected.location}</small></span>
                <span className="ir-option-check">✓</span>
              </button>
            )}
            {presets.map(field => (
              <button className={"ir-farm-option" + (field.id === selected.id ? " is-selected" : "")}
                type="button" key={field.id} aria-pressed={field.id === selected.id}
                onClick={() => { onSelect(field); close(); }}>
                <span className="ir-option-text"><strong>{field.name}</strong><small>{field.location}</small></span>
                {field.id === selected.id && <span className="ir-option-check">✓</span>}
              </button>
            ))}
          </div>
          <p className="ir-geocoder-credit">Search: <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> / Open-Meteo</p>
        </div>
      ) : null}
    </div>
  );
}
