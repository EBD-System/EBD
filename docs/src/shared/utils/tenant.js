function normalizeTenantId(value) {
  if (value === undefined || value === null || value === '') return null;

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;

  return Math.trunc(parsed);
}

function resolveTenantId(source = {}) {
  if (!source || typeof source !== 'object') return null;

  // Tenant confiável vem apenas do contexto autenticado que a API define.
  // Não há mais fallback para headers, query, body ou sub-objetos legados de cadastro.
  const candidates = [
    source.tenantId,
    source.user?.id_cadastro
  ];

  for (const candidate of candidates) {
    const tenantId = normalizeTenantId(candidate);
    if (tenantId !== null) return tenantId;
  }

  return null;
}

function requireTenantId(source = {}, scope = 'recurso') {
  const idCadastro = resolveTenantId(source);
  if (idCadastro === null) {
    throw new Error(`id_cadastro é obrigatório para acessar ${scope}.`);
  }
  return idCadastro;
}

module.exports = {
  normalizeTenantId,
  resolveTenantId,
  requireTenantId
};
