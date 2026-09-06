# Sessão 2026-08-10 — permissões de Relatórios e Presenças

## O que foi alterado
- O dashboard passou a esconder o módulo `Relatórios` para o perfil `Secretaria`, mantendo `Classes`.
- O hub de Relatórios passou a validar o acesso no backend e abrir `APP_ACCESS_DENIED_DIALOG` em HTTP 403.
- O submódulo `Presenças` continua tratando 403 com o diálogo padrão.
- Foi mantido o comportamento do perfil `Financeiro`: no hub ele enxerga somente `Financeiro`.

## Conhecimento consolidado
- O frontend de Relatórios não deve ser considerado uma barreira de segurança isolada; o backend define o acesso real.
- `Financeiro` não deve acessar `Presenças` nem os demais relatórios não financeiros.
- `Secretaria` não deve acessar o módulo principal de Relatórios.

## Próximos passos
- Reutilizar as regras centralizadas de perfil caso novos módulos protegidos sejam adicionados.
