import { useEffect } from "react";
import {
  countryCodeToName,
  countryNameToCode,
  findParkByRoute,
  parkById,
} from "../data/parks";
import { DEFAULT_COUNTRY, getParkSlug } from "../lib/parkUtils";

const getUrlBasePath = () => import.meta.env.BASE_URL.replace(/\/+$/, "");

const getPathSegments = () => {
  const basePath = getUrlBasePath();
  let path = window.location.pathname;
  if (basePath && path.startsWith(basePath)) path = path.slice(basePath.length);
  return path
    .split("/")
    .filter(Boolean)
    .map((segment) => decodeURIComponent(segment));
};

export const readUrlState = () => {
  const params = new URLSearchParams(window.location.search);
  const visitedParam = params.get("visited");
  const [countryCode, parkSlug] = getPathSegments();
  const selectedPark = findParkByRoute(countryCode, parkSlug);
  return {
    searchTerm: params.get("q") ?? "",
    // The leading path segment on a park link is just routing (the park's own
    // country code), not an intentional filter, so only treat it as a country
    // filter when the URL isn't pointing at a specific park.
    country: selectedPark
      ? DEFAULT_COUNTRY
      : (countryCodeToName.get(countryCode) ?? DEFAULT_COUNTRY),
    excludeWar: params.get("war") !== "0",
    visitedFilter: ["visited", "unvisited"].includes(visitedParam)
      ? visitedParam
      : "all",
    selectedId: selectedPark?.id ?? null,
  };
};

export default function useUrlState({
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
}) {
  useEffect(() => {
    const selectedPark = selectedId ? parkById.get(selectedId) : null;
    const pathCountryCode =
      country !== DEFAULT_COUNTRY
        ? countryNameToCode.get(country)
        : selectedPark?.code.toLowerCase();
    const segments = [];
    if (pathCountryCode) segments.push(pathCountryCode);
    if (selectedPark) segments.push(getParkSlug(selectedPark));
    const params = new URLSearchParams();
    if (searchTerm.trim()) params.set("q", searchTerm.trim());
    if (!excludeWar) params.set("war", "0");
    if (visitedFilter !== "all") params.set("visited", visitedFilter);
    const query = params.toString();
    window.history.replaceState(
      null,
      "",
      `${getUrlBasePath()}/${segments.join("/")}${query ? `?${query}` : ""}`,
    );
  }, [country, excludeWar, searchTerm, selectedId, visitedFilter]);

  useEffect(() => {
    const handlePopState = () => {
      const next = readUrlState();
      setSearchTerm(next.searchTerm);
      setCountry(next.country);
      setExcludeWar(next.excludeWar);
      setVisitedFilter(next.visitedFilter);
      setSelectedId(next.selectedId);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [
    setCountry,
    setExcludeWar,
    setSearchTerm,
    setSelectedId,
    setVisitedFilter,
  ]);
}
