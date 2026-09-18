import { getCountryName, getParkSlug } from "../lib/parkUtils";

const parkDataModules = import.meta.glob("./national_parks/*.json", {
  eager: true,
  import: "default",
});

export const parks = Object.values(parkDataModules).flat();
export const parkById = new Map(parks.map((park) => [park.id, park]));
export const countries = [
  "All countries",
  ...new Set(parks.map((park) => getCountryName(park.country))),
];
export const countryCodeToName = new Map(
  parks.map((park) => [park.code.toLowerCase(), getCountryName(park.country)]),
);
export const countryNameToCode = new Map(
  parks.map((park) => [getCountryName(park.country), park.code.toLowerCase()]),
);

export const findParkByRoute = (countryCode, parkSlug) =>
  parkSlug
    ? parks.find(
        (park) =>
          getParkSlug(park) === parkSlug &&
          (!countryCode || park.code.toLowerCase() === countryCode),
      )
    : null;
