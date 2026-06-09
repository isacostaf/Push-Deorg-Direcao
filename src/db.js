const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const TIMESTAMPS_FILE = path.join(__dirname, '..', 'timestamps.json');

function useSupabase() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

function formatTimestamp(date) {
  if (!date) return null;

  return new Date(date).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function readFileTimestamps() {
  try {
    return JSON.parse(fs.readFileSync(TIMESTAMPS_FILE, 'utf8'));
  } catch {
    return { lastUpload: null, lastExport: null };
  }
}

function writeFileTimestamps(data) {
  fs.writeFileSync(TIMESTAMPS_FILE, JSON.stringify(data, null, 2));
}

async function getTimestamps() {
  if (useSupabase()) {
    const { data, error } = await getSupabase()
      .from('app_stats')
      .select('last_upload, last_export')
      .eq('id', 1)
      .single();

    if (error) throw error;

    return {
      lastUpload: formatTimestamp(data.last_upload),
      lastExport: formatTimestamp(data.last_export),
    };
  }

  const data = readFileTimestamps();
  return {
    lastUpload: formatTimestamp(data.lastUpload),
    lastExport: formatTimestamp(data.lastExport),
  };
}

async function recordUpload() {
  const now = new Date().toISOString();

  if (useSupabase()) {
    const { error } = await getSupabase()
      .from('app_stats')
      .update({ last_upload: now })
      .eq('id', 1);

    if (error) throw error;
    return;
  }

  const data = readFileTimestamps();
  data.lastUpload = now;
  writeFileTimestamps(data);
}

async function recordExport() {
  const now = new Date().toISOString();

  if (useSupabase()) {
    const { error } = await getSupabase()
      .from('app_stats')
      .update({ last_export: now })
      .eq('id', 1);

    if (error) throw error;
    return;
  }

  const data = readFileTimestamps();
  data.lastExport = now;
  writeFileTimestamps(data);
}

module.exports = {
  getTimestamps,
  recordUpload,
  recordExport,
};
