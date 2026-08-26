CREATE TABLE IF NOT EXISTS parking (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  latitude REAL NOT NULL CHECK (latitude >= -90 AND latitude <= 90),
  longitude REAL NOT NULL CHECK (longitude >= -180 AND longitude <= 180),
  accuracy REAL CHECK (accuracy IS NULL OR accuracy >= 0),
  parked_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  saved_by TEXT NOT NULL CHECK (saved_by IN ('Adri', 'Laura'))
);

CREATE INDEX IF NOT EXISTS idx_parking_latest
ON parking (id DESC);
