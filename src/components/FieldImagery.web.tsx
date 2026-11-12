import React, { useMemo, useState } from "react";

type Coordinates = { latitude: number; longitude: number; location: string; name: string };

const SERVICE = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile";
const TILE_SIZE = 256;
const ZOOM = 14;

/** Web Mercator XYZ tiles, calculated from the selected site's coordinates. */
export function tilesForLocation(latitude: number, longitude: number, zoom = ZOOM) {
  const lat = Math.max(-85.05112878, Math.min(85.05112878, latitude));
  const lon = Math.max(-180, Math.min(180, longitude));
  const scale = 2 ** zoom;
  const worldX = ((lon + 180) / 360) * scale;
  const angle = (lat * Math.PI) / 180;
  const worldY = ((1 - Math.asinh(Math.tan(angle)) / Math.PI) / 2) * scale;
  const centerX = Math.floor(worldX);
  const centerY = Math.floor(worldY);
  const pixelOffsetX = (worldX - centerX) * TILE_SIZE;
  const pixelOffsetY = (worldY - centerY) * TILE_SIZE;

  return Array.from({ length: 9 }, (_, i) => {
    const dx = (i % 3) - 1;
    const dy = Math.floor(i / 3) - 1;
    const tileX = ((centerX + dx) % scale + scale) % scale;
    const tileY = Math.max(0, Math.min(scale - 1, centerY + dy));

    return {
      key: tileX + "-" + tileY,
      src: SERVICE + "/" + zoom + "/" + tileY + "/" + tileX,
      left: "calc(50% + " + (dx * TILE_SIZE - pixelOffsetX) + "px)",
      top: "calc(50% + " + (dy * TILE_SIZE - pixelOffsetY) + "px)",
    };
  });
}

/**
 * Actual satellite tiles of approximate demo-site coordinates.
 * Does not claim these synthetic demo sites are real farms or that the imagery
 * represents an exact legal parcel boundary.
 */
export function FieldImagery({ latitude, longitude, location, name }: Coordinates) {
  const [isUnavailable, setIsUnavailable] = useState(false);
  const tiles = useMemo(() => tilesForLocation(latitude, longitude), [latitude, longitude]);
  const mapUrl = "https://www.openstreetmap.org/?mlat=" +
    encodeURIComponent(latitude) + "&mlon=" + encodeURIComponent(longitude) +
    "#map=14/" + encodeURIComponent(latitude) + "/" + encodeURIComponent(longitude);

  return (
    <div className="ir-farm-image ir-satellite-preview" role="group" aria-label={"Satellite imagery near " + location}>
      {!isUnavailable ? (
        <div className="ir-satellite-viewport" role="img" aria-label={"Real satellite imagery around the approximate site location in " + location}>
          {tiles.map(tile => (
            <img
              key={tile.key}
              src={tile.src}
              loading="lazy"
              decoding="async"
              alt=""
              draggable={false}
              className="ir-satellite-tile"
              style={{ left: tile.left, top: tile.top }}
              onError={() => setIsUnavailable(true)}
            />
          ))}
          <span className="ir-satellite-center" aria-hidden="true" />
        </div>
      ) : (
        <div className="ir-satellite-unavailable">Satellite imagery temporarily unavailable.</div>
      )}
      <div className="ir-farm-caption"><span className="ir-location-dot" />{name}</div>
      <a className="ir-satellite-map-link" href={mapUrl} target="_blank" rel="noopener noreferrer">Open map ↗</a>
      <div className="ir-satellite-attribution">
        <span>Approximate area, not a mapped farm boundary</span>
        <a href="https://www.esri.com/en-us/arcgis/products/arcgis-online/resources" target="_blank" rel="noopener noreferrer">Imagery © Esri, Vantor, Earthstar Geographics, GIS User Community</a>
      </div>
    </div>
  );
}
