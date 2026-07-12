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

  const firstBlock = rest.slice(0, 1);
  const secondBlock = rest.slice(1, 5);
  const thirdBlock = rest.slice(5, 9);

  return `(${ddd}) ${firstBlock}${secondBlock}${thirdBlock ? `-${thirdBlock}` : ''}`;
}

function formatBrazilCellPhone(value) {
  return formatToBrPhone(value);
}

function formatCelular(value) {
  return formatToBrPhone(value);
}
