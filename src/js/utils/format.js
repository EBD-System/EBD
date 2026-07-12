function formatToBrPhone(phone = '') {
  const digits = String(phone || '').replace(/\D/g, '').slice(0, 11);

  if (!digits) return '';

  const ddd = digits.slice(0, 2);
  const rest = digits.slice(2);

  if (digits.length <= 2) {
    return `(${ddd}`;
  }

  if (digits.length <= 3) {
    return `(${ddd}) ${rest}`;
  }

  if (digits.length <= 7) {
    return `(${ddd}) ${rest.slice(0, 1)}${rest.slice(1)}`;
  }

  return `(${ddd}) ${rest.slice(0, 1)}${rest.slice(1, 5)}-${rest.slice(5, 9)}`;
}

function formatBrazilCellPhone(value) {
  return formatToBrPhone(value);
}

function formatCelular(value) {
  return formatToBrPhone(value);
}
