# FIELD_TEST_EXECUTION_PROTOCOL

Data: 2026-07-20
Estado: ATIVO

## Janela recomendada
- Minimo: 5 dias uteis
- Ideal: 7 dias corridos de operacao assistida

## Perfis de teste
- Admin operacional
- Tecnico de campo
- Cliente final (amostra controlada)

## Matriz de cenarios
1. Tecnico
- Inicio/fim de jornada
- Navegacao de rota
- Check-in/check-out de visita
- Upload de fotos em rede instavel
- Reenvio apos reconexao

2. Admin
- Monitorizacao de operacao
- Cobranca e follow-up
- Notificacoes e comunicacoes
- Consulta de indicadores criticos

3. Cliente
- Consulta de historico
- Consulta de pagamentos
- Recepcao de notificacoes
- Interacoes basicas de suporte

## Regras durante campo
- Sem release de feature nova.
- Sem alteracao de layout por preferencia.
- Corrigir apenas bugs com impacto operacional.
- Registrar cada incidente com: perfil, acao, resultado esperado, resultado real, hora, dispositivo, evidencia e severidade.

## Severidade
- P0 - Critico:
	- impede o trabalho do tecnico;
	- perda de dados;
	- crash;
	- sincronizacao falhada;
	- erro financeiro.
- P1 - Alto:
	- trabalho continua de forma limitada;
	- GPS incorreto;
	- upload de fotos falha;
	- calculos errados.
- P2 - Medio:
	- UX;
	- mensagens;
	- alinhamentos;
	- acessibilidade;
	- pequenos problemas visuais.
- P3 - Baixo:
	- melhorias;
	- sugestoes;
	- otimizacoes.

## Regra de tratamento durante os 5-7 dias
- P0 e P1: corrigir imediatamente apos reproducao e validacao.
- P2 e P3: apenas registrar durante a janela de campo; corrigir no fecho da validacao.

## Criterio de saida
- 0 pendencia P0/P1 aberta
- P2 controlado com plano e prazo
- Validacao final assinada pelos responsaveis de operacao

## Criterio de saida para release
- P0 = 0
- P1 = 0
- Sincronizacao estavel
- GPS estavel
- Offline/online validado
- Upload de fotografias validado
- Tecnicos conseguem operar 1 semana sem bloqueios
- Clientes usam o portal sem problemas criticos
