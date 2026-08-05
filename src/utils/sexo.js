const SEXO_STORAGE_MAP = {
  masculino: 'M',
  feminino: 'F',
  m: 'M',
  f: 'F',
  outro: 'outro',
  nao_informado: 'nao_informado',
  'não_informado': 'nao_informado'
};

const SEXO_API_MAP = {
  M: 'masculino',
  F: 'feminino',
  m: 'masculino',
  f: 'feminino',
  outro: 'outro',
  nao_informado: 'nao_informado',
  'não_informado': 'nao_informado'
};

function normalizeSexoForStorage(value) {
  if (value === undefined || value === null || value === '') {
    return 'nao_informado';
  }

  const normalized = String(value).trim();
  if (!normalized) return 'nao_informado';

  const mapped = SEXO_STORAGE_MAP[normalized.toLowerCase()] || SEXO_STORAGE_MAP[normalized];
  return mapped || normalized;
}

function normalizeSexoForApi(value) {
  if (value === undefined || value === null || value === '') {
    return value;
  }

  const normalized = String(value).trim();
  if (!normalized) return normalized;

  const mapped = SEXO_API_MAP[normalized] || SEXO_API_MAP[normalized.toLowerCase()];
  return mapped || normalized;
}

function normalizePersonSexo(person) {
  if (!person || typeof person !== 'object') return person;
  return {
    ...person,
    sexo: normalizeSexoForApi(person.sexo)
  };
}

module.exports = {
  normalizeSexoForStorage,
  normalizeSexoForApi,
  normalizePersonSexo
};
