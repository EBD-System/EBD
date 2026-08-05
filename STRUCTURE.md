# Estrutura recomendada do frontend

Este projeto foi reorganizado para separar claramente:

- **app/config**: configurações globais e variáveis de ambiente.
- **modules**: domínios e fluxos do sistema.
- **shared**: componentes, constantes, helpers, utilitários e serviços reutilizáveis.
- **assets**: imagens, ícones, fontes e recursos estáticos.

A organização foi pensada para um frontend estático que consome API, cresce por domínio e se mantém alinhado à modelagem do banco.
