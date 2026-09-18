import "@maplibre/maplibre-gl-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { setWorkerUrl } from "maplibre-gl";
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { MapContainer, Marker, Popup, useMap } from "react-leaflet";
import Supercluster from "supercluster";
import "./App.css";
import ParkDetails from "./components/ParkDetails";
import SearchableSelect from "./components/SearchableSelect";
import { countries, parkById, parks } from "./data/parks";
import useMapSizeFix from "./hooks/useMapSizeFix";
import useUrlState, { readUrlState } from "./hooks/useUrlState";
import useVectorMapStyle from "./hooks/useVectorMapStyle";
import {
  getCountryCounts,
  getCountryName,
  getParkTitle,
  isCountryAtWar,
} from "./lib/parkUtils";

setWorkerUrl(maplibreWorkerUrl);

const EUROPE_BOUNDS = [
  [34, -25],
  [72, 60],
];
const ALL_WORLD_BOUNDS = [-180, -90, 180, 90];

const MARKER_CORE_CIRCLE = `<circle class="park-marker__core" cx="12" cy="12" r="3"/>`;
const MARKER_CORE_CHECK = `<path class="park-marker__check" d="M8 12.5l2.6 2.6L16.5 8.6"/>`;
const getPinMarkup = (visited) =>
  `<span class="park-marker__pin"><svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false"><circle class="park-marker__glow" cx="12" cy="12" r="10"/><circle class="park-marker__ring" cx="12" cy="12" r="7"/>${visited ? MARKER_CORE_CHECK : MARKER_CORE_CIRCLE}</svg></span>`;
const markerIconCache = new Map();

const getMarkerIcon = (variant, isSelected, visited) => {
  const key = `${variant}:${isSelected}:${visited}`;
  if (!markerIconCache.has(key)) {
    const pinMarkup = getPinMarkup(visited);
    markerIconCache.set(
      key,
      L.divIcon({
        className: `park-marker park-marker--${variant}${isSelected ? " is-selected" : ""}${visited ? " is-visited" : ""}`,
        html: isSelected
          ? `<span class="park-marker__halo"></span><span class="park-marker__halo park-marker__halo--delay"></span>${pinMarkup}`
          : pinMarkup,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
        popupAnchor: [0, -14],
      }),
    );
  }
  return markerIconCache.get(key);
};

const clusterIconCache = new Map();

const getClusterIcon = (count, variant) => {
  const key = `${variant}:${count}`;
  if (!clusterIconCache.has(key)) {
    const size = count < 10 ? 26 : count < 50 ? 32 : 38;
    clusterIconCache.set(
      key,
      L.divIcon({
        className: `park-cluster park-cluster--${variant}`,
        html: `<span class="park-cluster__bubble">${count}</span>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      }),
    );
  }
  return clusterIconCache.get(key);
};

function MapZoomButtons() {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());

  useEffect(() => {
    const updateZoom = () => setZoom(map.getZoom());
    updateZoom();
    map.on("zoomend", updateZoom);

    return () => map.off("zoomend", updateZoom);
  }, [map]);

  return (
    <div className="zoom-controls">
      <button
        onClick={() => {
          if (zoom < map.getMaxZoom()) map.zoomIn();
        }}
        aria-label="Zoom in"
        aria-disabled={zoom >= map.getMaxZoom()}
        // Native `disabled` removes the button from hit-testing, so clicks
        // fall through to whatever marker sits underneath it on the map.
        className={zoom >= map.getMaxZoom() ? "is-disabled" : ""}
      >
        +
      </button>
      <span>{zoom}×</span>
      <button
        onClick={() => {
          if (zoom > map.getMinZoom()) map.zoomOut();
        }}
        aria-label="Zoom out"
        aria-disabled={zoom <= map.getMinZoom()}
        className={zoom <= map.getMinZoom() ? "is-disabled" : ""}
      >
        −
      </button>
    </div>
  );
}

function MapSizeFix() {
  const map = useMap();
  useMapSizeFix(map);
  return null;
}

function MapStyleLayer({ onTilesError, retryKey }) {
  const map = useMap();
  useVectorMapStyle(map, onTilesError, retryKey);
  return null;
}

function InitialParkFocus({ selectedPark }) {
  const map = useMap();

  // Runs inside MapContainer so the Leaflet instance is guaranteed to exist,
  // unlike the App-level mapRef which isn't populated on the very first render.
  // Empty deps: this must only ever act on the park selected from the URL at
  // mount time, never on a later click-driven selectedPark change (which is
  // already animated by focusPark's flyTo).
  useEffect(() => {
    if (!selectedPark) return;
    // setView (not flyTo) snaps immediately: Leaflet's flyTo treats duration: 0
    // as falsy and substitutes its own multi-second animation instead.
    map.setView(
      [selectedPark.latitude, selectedPark.longitude],
      Math.max(map.getZoom(), 11),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

function ParkMarkers({ visibleParks, selectedId, onSelect }) {
  const map = useMap();
  const [clusters, setClusters] = useState([]);
  const markerRefs = useRef(new Map());
  const openedPopupForId = useRef(null);

  // Supercluster indexes the points in a KD-tree once per filter change, so
  // querying the complete park set on zoom stays cheap.
  const indexes = useMemo(() => {
    return ["open", "caution"].map((variant) => {
      const supercluster = new Supercluster({
        radius: 78,
        maxZoom: 10,
        minPoints: 2,
      });
      supercluster.load(
        visibleParks
          .filter((park) =>
            variant === "caution"
              ? isCountryAtWar(park)
              : !isCountryAtWar(park),
          )
          .map((park) => ({
            type: "Feature",
            properties: { parkId: park.id },
            geometry: {
              type: "Point",
              coordinates: [park.longitude, park.latitude],
            },
          })),
      );
      return { index: supercluster, variant };
    });
  }, [visibleParks]);

  useEffect(() => {
    const updateClusters = () => {
      setClusters(
        indexes.flatMap(({ index, variant }) =>
          index
            .getClusters(ALL_WORLD_BOUNDS, Math.round(map.getZoom()))
            .map((feature) => ({ feature, index, variant })),
        ),
      );
    };

    updateClusters();
    map.on("zoomend", updateClusters);
    return () => {
      map.off("zoomend", updateClusters);
    };
  }, [indexes, map]);

  // Opens the popup once the selected park's marker exists (it may only mount
  // after a cluster splits open), so shared links and list selections behave
  // like clicking the marker directly. Deferred a frame because a freshly
  // mounted Popup rebinds itself (StrictMode double-invokes its effect in
  // dev), which would immediately close a popup opened in the same tick.
  // Only opens once per selection (tracked via openedPopupForId) so panning
  // around later, which also recomputes clusters, doesn't reopen the popup
  // and auto-pan the map back to the selected park.
  useEffect(() => {
    if (openedPopupForId.current === selectedId) return;
    const marker = markerRefs.current.get(selectedId);
    if (!marker) return;
    openedPopupForId.current = selectedId;
    const frame = requestAnimationFrame(() => marker.openPopup());
    return () => cancelAnimationFrame(frame);
  }, [selectedId, clusters]);

  return clusters.map(({ feature, index, variant }) => {
    const [longitude, latitude] = feature.geometry.coordinates;

    if (feature.properties.cluster) {
      const clusterId = feature.properties.cluster_id;
      return (
        <Marker
          key={`cluster-${variant}-${clusterId}`}
          position={[latitude, longitude]}
          icon={getClusterIcon(feature.properties.point_count, variant)}
          eventHandlers={{
            click: () =>
              map.flyTo(
                [latitude, longitude],
                Math.min(
                  index.getClusterExpansionZoom(clusterId),
                  map.getMaxZoom(),
                ),
                { duration: 0.6 },
              ),
          }}
        />
      );
    }

    const park = parkById.get(feature.properties.parkId);
    const isSelected = park.id === selectedId;

    return (
      <Marker
        key={park.id}
        position={[park.latitude, park.longitude]}
        title={park.name}
        alt={park.name}
        zIndexOffset={isSelected ? 1000 : 0}
        icon={getMarkerIcon(
          isCountryAtWar(park) ? "caution" : "open",
          isSelected,
          Boolean(park.visited),
        )}
        eventHandlers={{ click: () => onSelect(park.id) }}
        ref={(instance) => {
          if (instance) markerRefs.current.set(park.id, instance);
          else markerRefs.current.delete(park.id);
        }}
      >
        <Popup autoPan={false}>
          <strong>{park.name}</strong>
          <br />
          {getCountryName(park.country)}
        </Popup>
      </Marker>
    );
  });
}

function App() {
  const [searchTerm, setSearchTerm] = useState(() => readUrlState().searchTerm);
  const [country, setCountry] = useState(() => readUrlState().country);
  const [excludeWar, setExcludeWar] = useState(() => readUrlState().excludeWar);
  const [visitedFilter, setVisitedFilter] = useState(
    () => readUrlState().visitedFilter,
  );
  const [selectedId, setSelectedId] = useState(() => readUrlState().selectedId);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [cardExpanded, setCardExpanded] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [tilesFailed, setTilesFailed] = useState(false);
  const [mapRetryKey, setMapRetryKey] = useState(0);
  const [linkCopied, setLinkCopied] = useState(false);
  const mapRef = useRef(null);
  const resultsRef = useRef(null);
  const sidebarRef = useRef(null);

  const visibleParks = useMemo(
    () =>
      parks.filter((park) => {
        const normalizedSearch = searchTerm.trim().toLowerCase();
        const searchableText = [
          park.name,
          getCountryName(park.country),
          park.code,
        ]
          .join(" ")
          .toLowerCase();

        return (
          (!normalizedSearch || searchableText.includes(normalizedSearch)) &&
          (country === "All countries" ||
            getCountryName(park.country) === country) &&
          (!excludeWar || !isCountryAtWar(park)) &&
          (visitedFilter === "all" ||
            (visitedFilter === "visited" && park.visited) ||
            (visitedFilter === "unvisited" && !park.visited))
        );
      }),
    [country, excludeWar, searchTerm, visitedFilter],
  );
  const selectedPark = visibleParks.find((park) => park.id === selectedId);

  // Counts reflect search/war/visited filters but ignore the country filter itself, so every option previews its own result count.
  const countryCounts = useMemo(
    () => getCountryCounts(parks, { searchTerm, excludeWar, visitedFilter }),
    [excludeWar, searchTerm, visitedFilter],
  );
  const getCountryOptionBadge = (option) => countryCounts.get(option) ?? 0;

  useLayoutEffect(() => {
    if (filtersOpen) sidebarRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [filtersOpen]);

  useEffect(() => {
    resultsRef.current
      ?.querySelector(`[data-park-id="${selectedPark?.id}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [selectedPark]);

  useEffect(() => {
    if (filtersOpen) sidebarRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [filtersOpen]);

  useUrlState({
    country,
    excludeWar,
    searchTerm,
    selectedId,
    setCountry,
    setExcludeWar,
    setSearchTerm,
    setSelectedId,
    setVisitedFilter,
    visitedFilter,
  });

  const copyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = window.location.href;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const focusPark = (park, { duration = 0.8 } = {}) => {
    const map = mapRef.current;
    setSelectedId(park.id);
    setFiltersOpen(false);
    if (!map) return;

    // The map's minZoom (6) can clip the natural zoom-out/zoom-in curve flyTo
    // uses for long hops, making distant jumps look like they snap mid-flight.
    // Relax it just for this flight, then restore it once the flight settles.
    map.setMinZoom(3);
    map.once("moveend", () => map.setMinZoom(6));

    map.flyTo(
      [park.latitude, park.longitude],
      // Must exceed the ParkMarkers cluster maxZoom so nearby parks never fly in as a cluster bubble.
      Math.max(map.getZoom(), 11),
      { duration, easeLinearity: 0.15 },
    );
  };

  const resetFilters = () => {
    setSearchTerm("");
    setCountry("All countries");
    setExcludeWar(true);
    setVisitedFilter("all");
  };

  return (
    <main className={`app-shell ${isDark ? "theme-dark" : ""}`}>
      <section className={`workspace ${filtersOpen ? "filters-open" : ""}`}>
        <div
          className="mobile-backdrop"
          onClick={() => setFiltersOpen(false)}
          aria-hidden="true"
        />
        <aside
          className={`sidebar ${filtersOpen ? "is-open" : ""}`}
          ref={sidebarRef}
        >
          <div className="sidebar-heading">
            <a className="wordmark" href="/" aria-label="Greenbound home">
              <img
                className="wordmark-mark"
                src={`${import.meta.env.BASE_URL}logo_transparent.png`}
                alt=""
                aria-hidden="true"
              />
              Greenbound
            </a>
            <button
              className="theme-toggle"
              type="button"
              onClick={() => {
                const nextIsDark = !isDark;
                setIsDark(nextIsDark);
                document.documentElement.dataset.theme = nextIsDark
                  ? "dark"
                  : "light";
              }}
              aria-label={isDark ? "Use light mode" : "Use dark mode"}
              title={isDark ? "Use light mode" : "Use dark mode"}
            >
              <span aria-hidden="true">{isDark ? "☀" : "☾"}</span>
            </button>
            <button
              className="sidebar-close"
              onClick={() => setFiltersOpen(false)}
              aria-label="Close filters"
            >
              ✕
            </button>
          </div>
          <label className="search-label">
            Search {visibleParks.length} places
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Try a park or country"
            />
          </label>
          <button type="button" className="copy-link" onClick={copyShareLink}>
            <span aria-hidden="true">🔗</span>{" "}
            {linkCopied ? "Link copied" : "Copy link to this view"}
          </button>
          <SearchableSelect
            label="Country"
            value={country}
            options={countries}
            onChange={setCountry}
            getOptionBadge={getCountryOptionBadge}
          />
          <div className="filter-block">
            <p className="filter-title">Quick filters</p>
            <button
              type="button"
              className={`filter-chip ${excludeWar ? "selected" : ""}`}
              onClick={() => setExcludeWar(!excludeWar)}
            >
              <span>◌</span> Exclude countries at war{" "}
              <b>{excludeWar ? "ON" : "OFF"}</b>
            </button>
            <div
              className="segmented-control"
              role="radiogroup"
              aria-label="Visited status"
            >
              {[
                { value: "all", label: "All" },
                { value: "visited", label: "Visited" },
                { value: "unvisited", label: "Unvisited" },
              ].map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={visitedFilter === value}
                  className={visitedFilter === value ? "selected" : ""}
                  onClick={() => setVisitedFilter(value)}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="reset-filters"
              onClick={resetFilters}
            >
              Reset filters
            </button>
          </div>
          <div className="legend">
            <p className="filter-title">Map legend</p>
            <p>
              <i className="legend-dot open" /> Open to visitors
            </p>
            <p>
              <i className="legend-dot caution" /> Check before travel
            </p>
          </div>
          <div className="results">
            <p className="filter-title">Results</p>
            <ul className="results-list" ref={resultsRef}>
              {visibleParks.length === 0 ? (
                <li className="results-empty">
                  <p>No parks match these filters.</p>
                  <p>Try a different country, search term or visited status.</p>
                  <button
                    type="button"
                    className="reset-filters"
                    onClick={resetFilters}
                  >
                    Reset filters
                  </button>
                </li>
              ) : (
                visibleParks.map((park) => (
                  <li key={park.id}>
                    <button
                      type="button"
                      data-park-id={park.id}
                      className={`result-item ${selectedPark?.id === park.id ? "is-selected" : ""}`}
                      onClick={() => focusPark(park)}
                    >
                      <i
                        className={`legend-dot ${isCountryAtWar(park) ? "caution" : "open"}`}
                      />
                      {park.visited && (
                        <i className="result-item__visited" aria-hidden="true">
                          ✓
                        </i>
                      )}
                      <span className="result-item__text">
                        <strong>{getParkTitle(park)}</strong>
                        <em>{getCountryName(park.country)}</em>
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        </aside>
        <div className="map-column">
          <div className="map-toolbar">
            <span>
              <strong>{visibleParks.length}</strong> parks in view
            </span>
          </div>
          <div className="map-body">
            <div
              className={`map-stage ${selectedPark ? "has-selected-park" : ""}`}
            >
              <button
                className="mobile-filters-toggle"
                onClick={() => setFiltersOpen(true)}
                aria-expanded={filtersOpen}
              >
                ☰ Filters
              </button>
              <MapContainer
                center={[49.8153, 6.1296]}
                zoom={6}
                minZoom={6}
                maxZoom={12}
                maxBounds={EUROPE_BOUNDS}
                maxBoundsViscosity={1}
                worldCopyJump={false}
                zoomSnap={0.25}
                scrollWheelZoom
                className="leaflet-map"
                ref={mapRef}
              >
                <MapSizeFix />
                <MapZoomButtons />
                <InitialParkFocus selectedPark={selectedPark} />
                <MapStyleLayer
                  mapStyle="osm"
                  onTilesError={setTilesFailed}
                  retryKey={mapRetryKey}
                />
                <ParkMarkers
                  visibleParks={visibleParks}
                  selectedId={selectedPark?.id}
                  onSelect={setSelectedId}
                />
              </MapContainer>
              {tilesFailed && (
                <div className="map-error-overlay" role="alert">
                  <p>The map tiles couldn't be loaded.</p>
                  <p>Check your internet connection and try again.</p>
                  <button
                    type="button"
                    className="reset-filters"
                    onClick={() => {
                      setTilesFailed(false);
                      setMapRetryKey((key) => key + 1);
                    }}
                  >
                    Retry
                  </button>
                </div>
              )}
            </div>
            <ParkDetails
              selectedPark={selectedPark}
              cardExpanded={cardExpanded}
              onToggle={() => setCardExpanded((open) => !open)}
            />
          </div>
        </div>
      </section>
    </main>
  );
}

export default App;
