export function normalizeUploadedPlaylistName(fileName = '') {
  const rawBaseName = String(fileName).trim().split(/[\\/]/).pop() ?? '';
  const collapsedName = rawBaseName.replace(/\s+/g, ' ').trim() || 'playlist.csv';
  const withExtension = collapsedName.toLowerCase().endsWith('.csv') ? collapsedName : `${collapsedName}.csv`;
  return withExtension.slice(0, 120);
}

export function sanitizePlaylistStem(fileName = '') {
  return String(fileName)
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-_.]+|[-_.]+$/g, '')
    .slice(0, 80) || 'playlist';
}

export function createStoredPlaylistFileName(entryId, fileName) {
  return `${entryId}-${sanitizePlaylistStem(fileName)}.csv`;
}

export function parseCsvLine(line = '') {
  const values = [];
  let currentValue = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const currentChar = line[index];

    if (currentChar === '"') {
      const nextChar = line[index + 1];
      if (inQuotes && nextChar === '"') {
        currentValue += '"';
        index += 1;
        continue;
      }

      inQuotes = !inQuotes;
      continue;
    }

    if (currentChar === ',' && !inQuotes) {
      values.push(currentValue);
      currentValue = '';
      continue;
    }

    currentValue += currentChar;
  }

  values.push(currentValue);
  return values.map((value) => value.trim());
}

export function parsePlaylistCsv(content = '') {
  const normalizedText = String(content).replace(/^\uFEFF/, '');
  const lines = normalizedText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) {
    return [];
  }

  const firstLine = lines[0]?.toLowerCase() ?? '';
  const startIndex = firstLine.includes('title') || firstLine.includes('titre') ? 1 : 0;
  const playlist = [];

  for (let index = startIndex; index < lines.length; index += 1) {
    const columns = parseCsvLine(lines[index]);
    if (columns.length < 2) {
      continue;
    }

    const title = String(columns[0] ?? '').trim();
    const artist = String(columns[1] ?? '').trim();
    if (!title && !artist) {
      continue;
    }

    playlist.push({
      title,
      artist,
      year: Number(columns[2]) || 0,
      yearBonus: Number(columns[3]) || 0
    });
  }

  return playlist;
}

export function serializePlaylistCsv(playlist) {
  const escapeCsvValue = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

  return [
    'title,artist,year,yearBonus',
    ...playlist.map((track) => [
      escapeCsvValue(track.title),
      escapeCsvValue(track.artist),
      Number(track.year) || 0,
      Number(track.yearBonus) || 0
    ].join(','))
  ].join('\n');
}