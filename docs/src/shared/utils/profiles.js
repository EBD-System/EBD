const PROFILE = Object.freeze({
  ADMINISTRADOR: 'Administrador',
  SECRETARIA: 'Secretaria',
  PROFESSOR: 'Professor',
  FINANCEIRO: 'Financeiro',
  CONSULTA: 'Consulta'
});

const PROFILE_ALIASES = new Map([
  ['administrador', PROFILE.ADMINISTRADOR],
  ['admin', PROFILE.ADMINISTRADOR],
  ['secretaria', PROFILE.SECRETARIA],
  ['secretario', PROFILE.SECRETARIA],
  ['secretária', PROFILE.SECRETARIA],
  ['secretário', PROFILE.SECRETARIA],
  ['professor', PROFILE.PROFESSOR],
  ['financeiro', PROFILE.FINANCEIRO],
  ['tesoureiro', PROFILE.FINANCEIRO],
  ['consulta', PROFILE.CONSULTA]
]);

function normalizeProfileKey(value) {
  if (value === undefined || value === null) return '';
  const text = String(value).trim();
  if (!text) return '';
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function canonicalizeProfile(value) {
  const key = normalizeProfileKey(value);
  if (!key) return null;
  return PROFILE_ALIASES.get(key) || null;
}

function normalizeProfiles(values) {
  if (!Array.isArray(values)) return [];
  const normalized = [];
  const seen = new Set();

  for (const value of values) {
    const canonical = canonicalizeProfile(value);
    if (!canonical || seen.has(canonical)) continue;
    seen.add(canonical);
    normalized.push(canonical);
  }

  return normalized;
}

function hasAnyProfile(userProfiles, requiredProfiles) {
  const normalizedUserProfiles = normalizeProfiles(userProfiles);
  const normalizedRequiredProfiles = normalizeProfiles(requiredProfiles);

  if (normalizedRequiredProfiles.length === 0) return true;

  return normalizedRequiredProfiles.some((profile) => normalizedUserProfiles.includes(profile));
}

module.exports = {
  PROFILE,
  canonicalizeProfile,
  hasAnyProfile,
  normalizeProfileKey,
  normalizeProfiles
};
