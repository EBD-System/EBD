# Armadilha: tela de login ocultada pelo modo self

## Problema

A rota `/login` pode ficar em branco quando a aplicação entra no modo `self`, porque a regra global escondia a `.app` inteira.

## Causa

A interface tratava `self` como um bloqueio total da aplicação, mas a própria tela de login também é renderizada dentro do shell principal.

## Solução

A ocultação da `.app` não deve valer quando `body[data-route-mode="login"]` estiver ativo. A rota `/login` precisa continuar visível mesmo sem sessão salva.

## Complemento

Quando existir sessão autenticada salva, a rota `/login` não deve permanecer na própria tela de login; ela deve encaminhar o usuário para `/chamada`.

A tela de login agora também precisa esconder todo o restante do shell, deixando visível apenas o portal de acesso.
