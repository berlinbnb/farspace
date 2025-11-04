const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname);
const ROOMS_FILE = path.join(DATA_DIR, 'rooms.json');

const ensureDataDir = () => {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
};

const readFileSafe = () => {
  try {
    ensureDataDir();
    if (!fs.existsSync(ROOMS_FILE)) {
      return {};
    }
    const raw = fs.readFileSync(ROOMS_FILE, 'utf-8');
    if (!raw.trim()) {
      return {};
    }
    return JSON.parse(raw);
  } catch (error) {
    console.error('Failed to load rooms from storage. Starting with empty state.', error);
    return {};
  }
};

const writeFileSafe = (rooms) => {
  try {
    ensureDataDir();
    const payload = JSON.stringify(rooms, null, 2);
    fs.writeFileSync(ROOMS_FILE, payload, 'utf-8');
  } catch (error) {
    console.error('Failed to persist rooms to storage.', error);
  }
};

module.exports = {
  loadRooms: readFileSafe,
  saveRooms: writeFileSafe,
  ROOMS_FILE,
};
