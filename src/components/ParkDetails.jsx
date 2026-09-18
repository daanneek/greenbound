import {
  formatVisitDate,
  getCountryName,
  getLatestVisitDate,
  getNavigationUrl,
  getParkNativeName,
  getParkTitle,
  getSortedVisitDates,
  isCountryAtWar,
} from "../lib/parkUtils";

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

export default function ParkDetails({ selectedPark, cardExpanded, onToggle }) {
  return (
    <article
      className={`park-card ${selectedPark ? "" : "no-selection"} ${cardExpanded ? "is-expanded" : ""}`}
    >
      {selectedPark ? (
        <>
          <button
            className="card-handle"
            onClick={onToggle}
            aria-expanded={cardExpanded}
          >
            <span className="card-handle__bar" />
            <span className="card-handle__label">
              {getParkTitle(selectedPark)}
            </span>
          </button>
          <div className="card-status">
            <span className={isCountryAtWar(selectedPark) ? "caution" : ""} />{" "}
            {isCountryAtWar(selectedPark) ? "Check before travel" : "Open"}
          </div>
          <h2>{getParkTitle(selectedPark)}</h2>
          {getParkNativeName(selectedPark) && (
            <p className="card-native-name">
              {getParkNativeName(selectedPark)}
            </p>
          )}
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
                {selectedPark.latitude}° N, {Math.abs(selectedPark.longitude)}°{" "}
                {selectedPark.longitude < 0 ? "W" : "E"}
              </strong>
            </div>
          </div>
          {selectedPark.description?.trim() && (
            <p className="card-description">{selectedPark.description}</p>
          )}
        </>
      ) : (
        <>
          <button
            className="card-handle"
            onClick={onToggle}
            aria-expanded={cardExpanded}
          >
            <span className="card-handle__bar" />
            <span className="card-handle__label">No park selected</span>
          </button>
          <div className="no-selection-content">
            <p className="filter-title">Park details</p>
            <h2>No park selected</h2>
            <p>
              Select a park from the results list or click a marker on the map
              to explore its details.
            </p>
          </div>
        </>
      )}
    </article>
  );
}
