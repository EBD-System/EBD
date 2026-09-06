# Status da chamada não é status de matrícula

## Problema
O front pode mostrar o status errado quando usa o mesmo campo para matrícula da turma e presença do dia.

## Causa
A API expõe duas camadas diferentes de estado:
- **enrollmentStatus**: ativo/inativo do aluno na classe;
- **attendanceStatus**: presente/atrasado/ausente na chamada.

## Solução
Manter os dois estados separados na tela. O filtro de abas continua usando o status de matrícula, enquanto os botões da chamada usam apenas o snapshot/retorno da API de presença.


# Armadilha de renderização durante o carregamento

## Problema
A lista de alunos pode ficar presa na mensagem de carregamento mesmo depois de a API já ter retornado dados.

## Causa
A função de renderização pode ser chamada enquanto `loadingStudents` ainda está `true`, bloqueando a construção da lista embora `state.students` já esteja preenchido.

## Solução
Garantir que a lista seja renderizada novamente quando o carregamento terminar e não usar o flag de carregamento como bloqueio permanente para a exibição dos dados já recebidos.