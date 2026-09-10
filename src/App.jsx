import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import Supercluster from "supercluster";
import "./App.css";

const parkDataModules = import.meta.glob("./data/national_parks/*.json", {
  eager: true,
  import: "default",
});
const parks = Object.values(parkDataModules).flat();
const parkById = new Map(parks.map((park) => [park.id, park]));
const countriesAtWar = new Set(["BY", "RU", "UA"]);

const getCountryName = (country) => country || "Unknown country";
const isCountryAtWar = (park) => countriesAtWar.has(park.code);
const getNavigationUrl = (park) => {
  const destination = `${park.latitude},${park.longitude}`;
  const userAgent = typeof navigator === "undefined" ? "" : navigator.userAgent;
  const isAppleMobile = /iPhone|iPad|iPod/i.test(userAgent);
  const isMobile = /Android|Mobile/i.test(userAgent);

  if (isAppleMobile) {
    return `https://maps.apple.com/?daddr=${destination}&q=${encodeURIComponent(park.name)}`;
  }

  return isMobile
    ? `geo:${destination}?q=${encodeURIComponent(park.name)}`
    : `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
};

// Visit dates are hand-edited in the JSON; count/latest are derived so there's one source of truth.
const getSortedVisitDates = (park) =>
  Array.isArray(park.visitDates) ? [...park.visitDates].sort() : [];
const getLatestVisitDate = (park) => {
  const dates = getSortedVisitDates(park);
  return dates[dates.length - 1];
};
const formatVisitDate = (dateString) =>
  new Date(dateString).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

const countries = [
  "All countries",
  ...new Set(parks.map((park) => getCountryName(park.country))),
];

const EUROPE_BOUNDS = [
  [34, -25],
  [72, 60],
];
const ALL_WORLD_BOUNDS = [-180, -90, 180, 90];

const MAP_STYLES = {
  osm: {
    label: "OpenStreetMap",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  },
  opentopo: {
    label: "OpenTopoMap",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="https://viewfinderpanoramas.org/">SRTM</a> | map style &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)',
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
  },
};

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

const mapStyleLabels = Object.values(MAP_STYLES).map((style) => style.label);
const getMapStyleKey = (label) =>
  Object.keys(MAP_STYLES).find((key) => MAP_STYLES[key].label === label);

function SearchableSelect({
  label,
  value,
  options,
  onChange,
  searchable = true,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const wrapperRef = useRef(null);
  const listRef = useRef(null);
  const id = useId();

  const matches = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return normalized && searchable
      ? options.filter((option) => option.toLowerCase().includes(normalized))
      : options;
  }, [options, query, searchable]);

  useEffect(() => {
    if (!open) return;

    const closeOnOutsideClick = (event) => {
      if (!wrapperRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () =>
      document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [open]);

  useEffect(() => {
    listRef.current?.children[activeIndex]?.scrollIntoView({
      block: "nearest",
    });
  }, [activeIndex, matches]);

  const openList = () => {
    if (open) return;
    setQuery("");
    setActiveIndex(Math.max(0, options.indexOf(value)));
    setOpen(true);
  };

  const commit = (option) => {
    onChange(option);
    setOpen(false);
    setQuery("");
  };

  const handleKeyDown = (event) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        openList();
        return;
      }
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((index) =>
        Math.min(Math.max(index + step, 0), matches.length - 1),
      );
    } else if (event.key === "Enter" && open) {
      event.preventDefault();
      if (matches[activeIndex]) commit(matches[activeIndex]);
    } else if (event.key === "Escape" && open) {
      event.preventDefault();
      setOpen(false);
      setQuery("");
    }
  };

  const listbox = open && (
    <ul
      className="combobox-list"
      id={`${id}-list`}
      role="listbox"
      ref={listRef}
    >
      {matches.length === 0 ? (
        <li className="combobox-empty">No matches</li>
      ) : (
        matches.map((option, index) => (
          <li
            key={option}
            id={`${id}-option-${index}`}
            role="option"
            aria-selected={option === value}
            className={`combobox-option ${index === activeIndex ? "is-active" : ""} ${option === value ? "is-selected" : ""}`}
            onMouseMove={() => setActiveIndex(index)}
            onPointerDown={(event) => {
              event.preventDefault();
              commit(option);
            }}
          >
            {option}
          </li>
        ))
      )}
    </ul>
  );

  if (!searchable) {
    return (
      <div className={`combobox ${open ? "is-open" : ""}`} ref={wrapperRef}>
        <label htmlFor={`${id}-input`}>{label}</label>
        <div className="combobox-field">
          <button
            id={`${id}-input`}
            type="button"
            className="combobox-trigger"
            role="combobox"
            aria-expanded={open}
            aria-controls={`${id}-list`}
            aria-haspopup="listbox"
            aria-activedescendant={
              open && matches[activeIndex]
                ? `${id}-option-${activeIndex}`
                : undefined
            }
            onClick={() => (open ? setOpen(false) : openList())}
            onKeyDown={handleKeyDown}
          >
            {value}
          </button>
          <span className="combobox-caret" aria-hidden="true" />
        </div>
        {listbox}
      </div>
    );
  }

  return (
    <div className={`combobox ${open ? "is-open" : ""}`} ref={wrapperRef}>
      <label htmlFor={`${id}-input`}>{label}</label>
      <div className="combobox-field">
        <input
          id={`${id}-input`}
          type="text"
          role="combobox"
          autoComplete="off"
          aria-expanded={open}
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          aria-activedescendant={
            open && matches[activeIndex]
              ? `${id}-option-${activeIndex}`
              : undefined
          }
          value={open ? query : value}
          placeholder={open ? value : undefined}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(0);
            setOpen(true);
          }}
          onFocus={openList}
          onClick={openList}
          onKeyDown={handleKeyDown}
        />
        <span className="combobox-caret" aria-hidden="true" />
      </div>
      {listbox}
    </div>
  );
}

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
      <button onClick={() => map.zoomIn()} aria-label="Zoom in">
        +
      </button>
      <span>{zoom}×</span>
      <button onClick={() => map.zoomOut()} aria-label="Zoom out">
        −
      </button>
    </div>
  );
}

function MapSizeFix() {
  const map = useMap();

  // Runs synchronously before paint (and before sibling components such as
  // ParkMarkers read map.getBounds() in their own mount effects), so the
  // map is already fitted to Europe on the very first render instead of
  // only becoming correct after a later pan/zoom/resize event.
  useLayoutEffect(() => {
    const fitMapToEurope = () => {
      map.invalidateSize();
      // Narrow viewports need a lower floor, otherwise Europe cannot fit horizontally.
      map.setMinZoom(map.getContainer().clientWidth < 760 ? 3 : 4.5);
      map.fitBounds(EUROPE_BOUNDS, {
        padding: [24, 24],
        maxZoom: 4.5,
        animate: false,
      });
    };
    fitMapToEurope();
    const resizeObserver = new ResizeObserver(fitMapToEurope);
    resizeObserver.observe(map.getContainer());

    return () => {
      resizeObserver.disconnect();
    };
  }, [map]);

  return null;
}

function MapStyleLayer({ mapStyle }) {
  const map = useMap();
  const style = MAP_STYLES[mapStyle] ?? MAP_STYLES.osm;

  useEffect(() => {
    map.invalidateSize();
  }, [map, mapStyle]);

  return (
    <TileLayer
      key={mapStyle}
      attribution={style.attribution}
      noWrap
      url={style.url}
    />
  );
}

function ParkMarkers({ visibleParks, selectedId, onSelect }) {
  const map = useMap();
  const [clusters, setClusters] = useState([]);

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
      >
        <Popup>
          <strong>{park.name}</strong>
          <br />
          {getCountryName(park.country)}
        </Popup>
      </Marker>
    );
  });
}

function ParkActionLinks({ park }) {
  const hasCoordinates =
    Number.isFinite(park.latitude) && Number.isFinite(park.longitude);
  const actions = [
    {
      label: "Info",
      href: park.website?.trim(),
      disabledReason: "No website link available",
    },
    {
      label: "Route",
      href: hasCoordinates ? getNavigationUrl(park) : "",
      disabledReason: "No coordinates available",
    },
    {
      label: "Video",
      href: park.youtubeUrl?.trim(),
      disabledReason: "No video available",
    },
  ];

  return (
    <div className="park-actions">
      {actions.map(({ label, href, disabledReason }) =>
        href ? (
          <a
            key={label}
            className="park-website"
            href={href}
            target="_blank"
            rel="noreferrer"
          >
            {label} <span aria-hidden="true">↗</span>
          </a>
        ) : (
          <span
            key={label}
            className="park-website is-disabled"
            aria-disabled="true"
            title={disabledReason}
          >
            {label}
          </span>
        ),
      )}
    </div>
  );
}

function App() {
  const [searchTerm, setSearchTerm] = useState("");
  const [country, setCountry] = useState("All countries");
  const [excludeWar, setExcludeWar] = useState(false);
  const [visitedFilter, setVisitedFilter] = useState("all");
  const [selectedId, setSelectedId] = useState("si-triglav-national-park");
  const [mapStyle, setMapStyle] = useState("osm");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [cardExpanded, setCardExpanded] = useState(false);
  const mapRef = useRef(null);
  const resultsRef = useRef(null);

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
  const selectedPark =
    visibleParks.find((park) => park.id === selectedId) ?? visibleParks[0];

  useEffect(() => {
    resultsRef.current
      ?.querySelector(`[data-park-id="${selectedPark?.id}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [selectedPark]);

  const focusPark = (park) => {
    setSelectedId(park.id);
    setFiltersOpen(false);
    mapRef.current?.flyTo(
      [park.latitude, park.longitude],
      // Must exceed the ParkMarkers cluster maxZoom so nearby parks never fly in as a cluster bubble.
      Math.max(mapRef.current.getZoom(), 11),
      { duration: 0.8 },
    );
  };

  const resetFilters = () => {
    setSearchTerm("");
    setCountry("All countries");
    setExcludeWar(false);
    setVisitedFilter("all");
  };

  return (
    <main className="app-shell">
      <section className={`workspace ${filtersOpen ? "filters-open" : ""}`}>
        <div
          className="mobile-backdrop"
          onClick={() => setFiltersOpen(false)}
          aria-hidden="true"
        />
        <aside className={`sidebar ${filtersOpen ? "is-open" : ""}`}>
          <button
            className="sidebar-close"
            onClick={() => setFiltersOpen(false)}
            aria-label="Close filters"
          >
            ✕
          </button>
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
          <SearchableSelect
            label="Country"
            value={country}
            options={countries}
            onChange={setCountry}
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
                <li className="results-empty">No parks match these filters</li>
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
                        <strong>{park.name}</strong>
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
            <div className="map-style-control">
              <SearchableSelect
                label="Map style"
                searchable={false}
                value={MAP_STYLES[mapStyle].label}
                options={mapStyleLabels}
                onChange={(label) => setMapStyle(getMapStyleKey(label))}
              />
            </div>
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
                center={[54, 15]}
                zoom={4.5}
                minZoom={4.5}
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
                <MapStyleLayer mapStyle={mapStyle} />
                <ParkMarkers
                  visibleParks={visibleParks}
                  selectedId={selectedPark?.id}
                  onSelect={setSelectedId}
                />
              </MapContainer>
            </div>
            {selectedPark && (
              <article
                className={`park-card ${cardExpanded ? "is-expanded" : ""}`}
              >
                <button
                  className="card-handle"
                  onClick={() => setCardExpanded((open) => !open)}
                  aria-expanded={cardExpanded}
                >
                  <span className="card-handle__bar" />
                  <span className="card-handle__label">
                    {selectedPark.name}
                  </span>
                </button>
                <div className="card-status">
                  <span
                    className={isCountryAtWar(selectedPark) ? "caution" : ""}
                  />{" "}
                  {isCountryAtWar(selectedPark)
                    ? "Check before travel"
                    : "Open"}
                </div>
                <h2>{selectedPark.name}</h2>
                <p className="card-location">
                  {getCountryName(selectedPark.country)} ·{" "}
                  {selectedPark.terrain || "National park"}
                </p>
                {selectedPark.visited && (
                  <div className="card-visited">
                    <span className="card-visited__check" aria-hidden="true">
                      ✓
                    </span>
                    Visited {getSortedVisitDates(selectedPark).length}×
                    <span className="card-visited__date">
                      Last: {formatVisitDate(getLatestVisitDate(selectedPark))}
                    </span>
                  </div>
                )}
                <ParkActionLinks park={selectedPark} />
                <div className="park-facts">
                  <div>
                    <span>Size</span>
                    <strong>
                      {selectedPark.sizeInSquareKilometers?.toString().trim()
                        ? `${selectedPark.sizeInSquareKilometers} km²`
                        : "-"}
                    </strong>
                  </div>
                  <div>
                    <span>National park since</span>
                    <strong>
                      {selectedPark.nationalParkSince?.toString().trim() || "-"}
                    </strong>
                  </div>
                  <div>
                    <span>Coordinates</span>
                    <strong>
                      {selectedPark.latitude}° N,{" "}
                      {Math.abs(selectedPark.longitude)}°{" "}
                      {selectedPark.longitude < 0 ? "W" : "E"}
                    </strong>
                  </div>
                </div>
                {selectedPark.description?.trim() && (
                  <p className="card-description">
                    {selectedPark.description}
                  </p>
                )}
              </article>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

export default App;
