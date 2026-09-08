# Greenbound

A single-page React + Vite app for exploring European national parks on an interactive Leaflet map.

- Filter by country, free-text search, or travel-advisory status
- Clustered map markers backed by `supercluster`
- Results list synced with the map, with fly-to on selection
- OpenStreetMap and OpenTopoMap basemaps
- Responsive down to phone widths

## Commands

```bash
npm install
npm run dev     # http://localhost:5173/
npm run build
npm run lint
```

## Data

Park records live in `src/data/national_parks/`, one JSON file per ISO country code. Coordinates come from a Google Earth "National Parks in Europe" KML export. See `agents.md` for the current data contract and the enrichment backlog.
