CREATE TABLE IF NOT EXISTS app_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  active_parking_id INTEGER,
  FOREIGN KEY (active_parking_id) REFERENCES parking(id)
);

INSERT OR IGNORE INTO app_state (id, active_parking_id)
SELECT 1, (SELECT id FROM parking ORDER BY id DESC LIMIT 1);
