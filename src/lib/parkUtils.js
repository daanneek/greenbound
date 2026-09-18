export const DEFAULT_COUNTRY = "All countries";
export const countriesAtWar = new Set(["BY", "RU", "UA"]);

export const getCountryName = (country) => country || "Unknown country";
export const getParkTitle = (park) =>
  park.name || park.englishName || "Unnamed park";
export const getParkNativeName = (park) =>
  park.nativeName ||
  park.originalName ||
  park.localName ||
  park.translatedName ||
  "";
export const isCountryAtWar = (park) => countriesAtWar.has(park.code);

export const getNavigationUrl = (park) => {
  const destination = `${park.latitude},${park.longitude}`;
  const userAgent = typeof navigator === "undefined" ? "" : navigator.userAgent;
  const isAppleMobile = /iPhone|iPad|iPod/i.test(userAgent);
  const isMobile = /Android|Mobile/i.test(userAgent);

  if (isAppleMobile) {
    return `https://maps.apple.com/?daddr=${destination}&q=${encodeURIComponent(getParkTitle(park))}`;
  }

  return isMobile
    ? `geo:${destination}?q=${encodeURIComponent(getParkTitle(park))}`
    : `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
};

export const getSortedVisitDates = (park) =>
  Array.isArray(park.visitDates) ? [...park.visitDates].sort() : [];
export const getLatestVisitDate = (park) => {
  const dates = getSortedVisitDates(park);
  return dates[dates.length - 1];
};
export const formatVisitDate = (dateString) =>
  new Date(dateString).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

export const getParkSlug = (park) => {
  const prefix = `${park.code.toLowerCase()}-`;
  return park.id.startsWith(prefix) ? park.id.slice(prefix.length) : park.id;
};

export const filterParks = (
  parks,
  { searchTerm, country, excludeWar, visitedFilter },
) => {
  const normalizedSearch = searchTerm.trim().toLowerCase();

  return parks.filter((park) => {
    const searchableText = [park.name, getCountryName(park.country), park.code]
      .join(" ")
      .toLowerCase();

    return (
      (!normalizedSearch || searchableText.includes(normalizedSearch)) &&
      (country === DEFAULT_COUNTRY ||
        getCountryName(park.country) === country) &&
      (!excludeWar || !isCountryAtWar(park)) &&
      (visitedFilter === "all" ||
        (visitedFilter === "visited" && park.visited) ||
        (visitedFilter === "unvisited" && !park.visited))
    );
  });
};

export const getCountryCounts = (
  parks,
  { searchTerm, excludeWar, visitedFilter },
) => {
  const counts = new Map();
  const matchingParks = filterParks(parks, {
    searchTerm,
    country: DEFAULT_COUNTRY,
    excludeWar,
    visitedFilter,
  });

  matchingParks.forEach((park) => {
    const name = getCountryName(park.country);
    counts.set(name, (counts.get(name) ?? 0) + 1);
  });
  counts.set(DEFAULT_COUNTRY, matchingParks.length);
  return counts;
};
