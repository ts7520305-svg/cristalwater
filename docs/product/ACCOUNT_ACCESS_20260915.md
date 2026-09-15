# TASK169 — Administração de contas protegida

A reprodução `field-qa-runtime/run-1789506972040` confirmou listagem anónima em `/api/users`. A revisão das rotas e controladores encontrou também criação/alteração de contas e alteração/reset de palavra-passe sem autenticação.

Os routers de utilizadores e segurança passam a exigir uma conta ADMIN ativa. Os registos de alteração de password e identidade usam o administrador autenticado, em vez de aceitar um autor indicado no corpo. O log genérico elimina também `currentPassword` e `newPassword`, além das credenciais anteriormente removidas.

Ensaio `field-qa-runtime/run-1789507058993` aprovado: visitante, cliente e técnico recusados na listagem, criação, alteração de identidade, password e reset; contas inalteradas após essas tentativas. O percurso administrativo continua a funcionar, o hash é verificado, o autor real fica registado e o log não contém as passwords. Inclui matriz de acessos e interligações completas. Testes unitários/técnicos/sintaxe executados antes do commit. Runner com 73 grupos.

Oito ficheiros: dois routers, controlador de segurança, middleware de auditoria, teste, runner, relatório e checkpoint. Sem alterações a contas reais. Esta correção não representa auditoria exaustiva dos restantes routers legados, nem altera a política de passwords ou a atomicidade dos antigos registos de auditoria.
