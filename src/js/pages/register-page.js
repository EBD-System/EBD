(function () {
  syncDebugConsoleVisibility();

  const els = {
    back: document.getElementById('registerBackBtn'),
    cancel: document.getElementById('registerCancel'),
    form: document.getElementById('registerForm'),
    loading: document.getElementById('registerLoading'),
    feedback: document.getElementById('feedback'),
    submit: document.querySelector('#registerForm button[type="submit"]'),
    nome: document.getElementById('registerNome'),
    login: document.getElementById('registerLogin'),
    senha: document.getElementById('registerSenha'),
    confirmarSenha: document.getElementById('registerConfirmarSenha'),
    cpf: document.getElementById('registerCpf'),
    sexo: document.getElementById('registerSexo'),
    dataNascimento: document.getElementById('registerDataNascimento'),
    telefone: document.getElementById('registerTelefone'),
    email: document.getElementById('registerEmail'),
    logradouro: document.getElementById('registerLogradouro'),
    numero: document.getElementById('registerNumero'),
    bairro: document.getElementById('registerBairro'),
    cidade: document.getElementById('registerCidade'),
    uf: document.getElementById('registerUf'),
    cep: document.getElementById('registerCep'),
    observacao: document.getElementById('registerObservacao'),
  };

  function buildBackUrl() {
    if (typeof buildRoutePath === 'function') return buildRoutePath('/login');
    try {
      return new URL('../login/', window.location.href).toString();
    } catch (err) {
      return '../login/';
    }
  }

  function applyReturnUrl() {
    const returnUrl = buildBackUrl();
    if (els.back) els.back.setAttribute('href', returnUrl);
    if (els.cancel) els.cancel.setAttribute('href', returnUrl);
  }

  function setFeedback(type, message) {
    if (!els.feedback) return;
    const text = String(message || '');
    els.feedback.className = `feedback show ${type}`;
    els.feedback.textContent = text;

    if (type === 'error' && text) {
      const debugText = /^\[(BACKEND|FRONTEND)\]/i.test(text) ? text : `[FRONTEND] ${text}`;
      appendDebugConsoleLine(debugText);
      if (isDebugConsoleEnabled()) {
        console.log(debugText);
      }
    }
  }

  function setLoadingVisible(isVisible) {
    if (els.loading) els.loading.classList.toggle('hidden', !isVisible);
    if (els.form) els.form.classList.toggle('hidden', isVisible);
  }

  function formatCpf(value) {
    return onlyDigits(value).slice(0, 11);
  }

  function formatCep(value) {
    return onlyDigits(value).slice(0, 8);
  }

  function formatUf(value) {
    return String(value || '').trim().toUpperCase().slice(0, 2);
  }

  function formatPhoneInput(event) {
    const input = event?.target;
    if (!input) return;
    input.value = formatToBrPhone(input.value);
  }

  function formatCpfInput(event) {
    const input = event?.target;
    if (!input) return;
    input.value = formatCpf(input.value);
  }

  function formatCepInput(event) {
    const input = event?.target;
    if (!input) return;
    input.value = formatCep(input.value);
  }

  function formatUfInput(event) {
    const input = event?.target;
    if (!input) return;
    input.value = formatUf(input.value);
  }

  async function submitForm(event) {
    event.preventDefault();

    const nome = String(els.nome?.value || '').trim();
    const login = String(els.login?.value || '').trim();
    const senha = String(els.senha?.value || '');
    const confirmarSenha = String(els.confirmarSenha?.value || '');
    const cpf = formatCpf(els.cpf?.value || '');
    const sexo = String(els.sexo?.value || 'nao_informado').trim();
    const dataNascimento = String(els.dataNascimento?.value || '').trim();
    const telefone = onlyDigits(els.telefone?.value || '');
    const email = String(els.email?.value || '').trim();
    const logradouro = String(els.logradouro?.value || '').trim();
    const numero = String(els.numero?.value || '').trim();
    const bairro = String(els.bairro?.value || '').trim();
    const cidade = String(els.cidade?.value || '').trim();
    const uf = formatUf(els.uf?.value || '');
    const cep = formatCep(els.cep?.value || '');
    const observacao = String(els.observacao?.value || '').trim();

    if (!nome) {
      setFeedback('error', 'Informe o nome completo.');
      return;
    }
    if (!login) {
      setFeedback('error', 'Informe o login.');
      return;
    }
    if (!senha) {
      setFeedback('error', 'Informe a senha.');
      return;
    }
    if (senha !== confirmarSenha) {
      setFeedback('error', 'A confirmação de senha não confere.');
      return;
    }

    showLoading('Registrando acesso...', 25000);
    setLoadingVisible(true);
    setFeedback('info', 'Enviando dados para o backend...');

    const payload = {
      nome,
      login,
      senha,
      cpf,
      sexo,
      dataNascimento,
      data_nascimento: dataNascimento,
      telefone,
      email,
      logradouro,
      numero,
      bairro,
      cidade,
      uf,
      cep,
      observacao,
    };

    try {
      const result = await authRegister(payload, { timeoutMs: 30000 });
      const okMessage = result?.message || 'Cadastro realizado com sucesso.';
      showSuccess(okMessage);
      setFeedback('success', okMessage);

      if (window.ProjectMemory) {
        window.ProjectMemory.recordFromEvent('register-user', {
          nome,
          login,
          cpf,
          sexo,
          email,
          cidade,
          uf,
        });
      }

      if (els.form) els.form.reset();
      if (els.nome) els.nome.focus();
      const loginUrl = buildBackUrl();
      if (loginUrl) {
        setTimeout(() => {
          window.location.href = loginUrl;
        }, 1200);
      }
    } catch (err) {
      const errorText = formatAppError(err, 'Registrar acesso');
      showError(errorText);
      setFeedback('error', errorText);
    } finally {
      hideLoading();
      setLoadingVisible(false);
    }
  }

  applyReturnUrl();

  if (els.telefone) {
    els.telefone.addEventListener('input', formatPhoneInput);
    els.telefone.addEventListener('blur', formatPhoneInput);
  }

  if (els.cpf) {
    els.cpf.addEventListener('input', formatCpfInput);
    els.cpf.addEventListener('blur', formatCpfInput);
  }

  if (els.cep) {
    els.cep.addEventListener('input', formatCepInput);
    els.cep.addEventListener('blur', formatCepInput);
  }

  if (els.uf) {
    els.uf.addEventListener('input', formatUfInput);
    els.uf.addEventListener('blur', formatUfInput);
  }

  if (els.form) {
    els.form.addEventListener('submit', submitForm);
  }

  document.addEventListener('DOMContentLoaded', () => {
    setLoadingVisible(false);
    if (els.loading) {
      els.loading.classList.add('hidden');
    }
    if (els.form) {
      els.form.classList.remove('hidden');
    }
    if (els.nome) {
      els.nome.focus();
    }
  });
})();
