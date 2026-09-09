# Greenbound Agent Notes

## Project

Greenbound is a single-page React/Vite app for exploring European national parks. The main experience is a filterable Leaflet map with clustered park markers, a synced results list, and a selected-park detail card. The UI wordmark is `Greenbound`; earlier notes called the project WILDatlas.

## Run and validate

- Install dependencies: `npm install`
- Start development server: `npm run dev`
- Build production bundle: `npm run build`
- Run lint: `npm run lint`
- Dev server uses the site root, so the local URL is `http://localhost:5173/`.

## Structure

- `src/App.jsx`: application state, filters, `SearchableSelect`, `ParkMarkers` clustering, Leaflet map, results list, and detail card.
- `src/App.css`: visual system and responsive layout, including Leaflet overrides.
- `src/index.css`: document-level typography and page defaults.
- `src/data/national_parks/*.json`: one file per country code, loaded eagerly with `import.meta.glob`.
- `public/logo_transparent.png`: the visible brand logo asset.
- `public/logo.svg`: the cropped browser favicon asset.
- `index.html`: document metadata and Vite entry point.

## Current map implementation

- Map library: `leaflet` with `react-leaflet`.
- Basemap: OpenStreetMap or OpenTopoMap tiles via `TileLayer`; keep attribution visible.
- Map center: `[54, 15]`, initial zoom `4.5`, maximum zoom `12`, `zoomSnap` `0.25` so the fractional fit zoom is honoured.
- Park locations use WGS84 decimal degrees in `latitude` and `longitude` fields. Do not use percentage positions or SVG silhouettes for geographic placement.
- `MapZoomButtons` must remain rendered inside `MapContainer`, because it uses `useMap()`.
- Marker selection updates `selectedId`; filtered markers are rendered from `visibleParks`.
- Markers are Leaflet `divIcon` teardrop pins built by `getMarkerIcon(variant, isSelected)` in `App.jsx`; icons are cached per `variant:isSelected` key. Variants are `open` and `caution`. All pin visuals, hover/active transitions and the selected halo pulse live in `App.css` under `.park-marker*`. Do not put transforms on the `.park-marker` root element, because Leaflet controls its `transform` and `position`.
- `MapSizeFix` lowers `minZoom` to `3` when the map container is narrower than 760px so Europe still fits on phones; wider containers keep `4.5`.
- Clustering uses `supercluster` inside the `ParkMarkers` component. The KD-tree index is rebuilt with `useMemo` only when `visibleParks` changes; `moveend`/`zoomend` just re-query `getClusters` for the current bbox, so panning stays cheap. Cluster bubbles are cached `divIcon`s (`getClusterIcon`) styled under `.park-cluster*`, and clicking one flies to `getClusterExpansionZoom`.
- `App` holds a `mapRef` on `MapContainer` so UI outside the map (the results list) can call `flyTo`.

## Park data contract

The park JSON under `src/data/national_parks/` carries a project-specific slug `id`, `name`, full country name in `country`, ISO-like country code in `code`, `latitude`, `longitude`, `description`, `sizeInSquareKilometers` and `website`. The `sizeInSquareKilometers` field is reserved for park area in square kilometers and is currently an empty string across the dataset until values can be added from a consistent authoritative source. The `year`, `terrain`, `status` and `war` fields referenced by the UI are not populated yet, which is why the detail card is sparse. Data enrichment is planned; document country definitions, area units, establishment-year rules, visitor status, and travel-advisory source when it lands.

## Product state

Implemented:

- Country dropdown filter, implemented as the `SearchableSelect` combobox in `App.jsx`: type-to-filter, arrow-key/Enter/Escape support, ARIA `combobox`/`listbox` roles, and outside-click dismissal. Styles live under `.combobox*` in `App.css`.
- Map style dropdown uses the same component with `searchable={false}`, which renders a button trigger instead of a text input. There are no native `select` elements left in the app; use `SearchableSelect` for new dropdowns so the styled panel and scrollbar stay consistent.
- Exclude-countries-at-war toggle.
- Search across park name, country name and country code.
- Clickable pin markers with hover, press and selection animations, plus Leaflet popups.
- Marker clustering via `supercluster`.
- Scrollable results list in the sidebar below the legend. Clicking an entry selects the park and flies the map to it; selecting a park on the map scrolls the matching entry into view. Only the list scrolls, never the page: `.app-shell` and `.sidebar` stay `overflow: hidden` on desktop and `.results-list` takes the remaining height.
- Selected park card with status, location and coordinates.
- Mobile layout (`max-width: 760px`): full-height map, filters in an off-canvas left drawer opened by a `.mobile-filters-toggle` button that floats over the top-left of the map, and the park card as a collapsible bottom sheet. All mobile chrome (`.mobile-filters-toggle`, `.sidebar-close`, `.card-handle`, `.mobile-backdrop`) is `display: none` on desktop, so desktop styling must stay untouched when editing it.
- There is no page header. The `Greenbound` wordmark lives alone in `.sidebar-heading`, and the live park count is folded into the search label as `Search {n} places`.

Known limitations:

- Park records lack area, establishment year, terrain and official links, so the detail card shows little.
- The `war` flag is a hardcoded country set rather than a dated, sourced advisory.
- OpenStreetMap tiles require network access in the browser, and OSM's tile policy discourages production use.
- Map zoom text is read from the Leaflet instance and is not currently subscribed to zoom events.
- Cluster bubbles do not indicate whether they contain caution-status parks.
- There are no automated tests.

## To check

Agreed backlog, roughly in priority order. Not started.

1. Enrich the park dataset: area, establishment year, IUCN category, terrain, description and official website link, with documented sources.
2. URL state: encode selected park, country filter, search term and map viewport so views are shareable and survive refresh and back/forward.
3. Favourites / trip list in `localStorage`, with GPX or GeoJSON export.
4. Filter by area, founding year, terrain type and IUCN category (depends on 1).
5. Multi-select countries plus region groupings (Nordics, Balkans, Alps).
6. Bounding-box filter: "only show parks in the current view", with the counter reflecting it.
7. Empty and error states, including tile-load failure.
8. Loading feedback for tiles and a skeleton for the detail card.
9. Tests for filtering, marker selection, coordinate formatting, and combobox keyboard behaviour.
10. Park detail pages with photos, seasons, access and transport notes, and nearby parks.
11. Park boundary polygons (for example WDPA / Protected Planet) instead of points.
12. Nature-focused overlays such as elevation, biome, or protected-area density.
13. Production tile provider with documented usage limits before deployment.
14. Replace the binary `war` flag with a dated, source-backed travel-advisory model.

Explicitly declined for now: geolocation / "parks near me".

## Editing guidance

Keep the map logic coordinate-based, preserve OpenStreetMap and OpenTopoMap attribution, avoid claiming the dataset is complete, and run `npm run lint` plus `npm run build` after changes to the map or data model.

`App.css` is the single stylesheet and has been pruned of rules for markup that no longer exists. When you delete an element, delete its rules too. Screenshot and trace output from browser tooling belongs in `.playwright-mcp/`, which is gitignored.

## Future monetization: Payhip

Planned provider: Payhip. Do not implement this yet. The site should sell digital route products such as GPX files, PDFs, maps, route notes and ZIP bundles for European national parks.

### Payhip setup required before integration

1. Create a Payhip account.
2. Connect Stripe and/or PayPal inside Payhip.
3. Create and publish the first digital products, including their uploaded files and prices.
4. Copy the public Payhip checkout URL for each product. These URLs normally look like `https://payhip.com/b/<product-id>`.
5. Provide the product names, prices and checkout URLs for the application configuration.

The application does not need Payhip API keys for the initial integration. It should use public hosted checkout links, opened in a new tab or through a normal external link. Never put Stripe, PayPal or Payhip secrets in this Vite frontend.

### Planned application integration

- Add a central product configuration module rather than scattering Payhip URLs through JSX or park JSON files.
- Support products attached to individual parks plus regional and country-wide packages.
- Render a reusable route-pack section in the selected park detail card.
- Hide products whose checkout URL is not configured, so unpublished products cannot create broken buttons.
- Use clear product labels and prices, for example `Five routes in Slovenia - EUR 5` or `Complete Slovenia route collection - EUR 15`.
- Open the hosted Payhip checkout in a new tab with appropriate external-link attributes.
- Keep the site usable when no products are configured; monetization must be additive and must not block map browsing.
- Prefer bundles over very cheap individual products because fixed payment-processing fees make EUR 0.50 sales inefficient.

A future configuration shape may be:

```js
const payhipProducts = {
  "si-triglav-national-park": {
    title: "Triglav route pack",
    price: "EUR 3",
    checkoutUrl: "https://payhip.com/b/your-product-id",
  },
  "slovenia-regional-pack": {
    title: "Slovenia national parks pack",
    price: "EUR 5",
    checkoutUrl: "https://payhip.com/b/your-product-id",
  },
};
```

The exact schema can change when the first Payhip products exist. Do not add placeholder checkout URLs to production UI.

### Product strategy

- Individual route or park pack: approximately EUR 1-3.
- Five-route bundle: approximately EUR 5.
- Regional package: approximately EUR 10.
- Country package: approximately EUR 15-20.
- Larger Europe or multi-country collection: price according to the amount of route material and support included.

Each product may contain a GPX route, offline map, PDF guide, waypoints, parking/access notes, difficulty, water points, seasonal warnings and filming locations where relevant. Product contents and route safety claims must be accurate and clearly described.

### Fees and legal notes

Payhip's free plan has no monthly fee but currently adds a 5% Payhip transaction fee on top of Stripe or PayPal processing fees. This is expected to be the initial no-code option. Recheck the official Payhip pricing, payment and tax documentation before launch because fees and provider features can change.

Payhip states that it can collect and remit EU and UK VAT, but this does not remove every business, income-tax, invoicing, consumer-rights, privacy or digital-content obligation. Confirm the requirements for the seller's country before selling. Include appropriate digital-content refund/withdrawal wording and privacy information at launch.

The first implementation should use a real low-priced test product, such as a EUR 1 route pack, so the complete external checkout and file-delivery flow can be verified before adding the larger regional and country catalogue.
