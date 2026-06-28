# ARCHITECTURE

Cristal Platform é dividida em:

- src/core: Crystal Kernel
- src/system: Crystal Brain
- src/routes: APIs existentes
- src/services: serviços atuais
- frontend: aplicação web

Regra principal:
Toda nova funcionalidade deve usar Kernel + Brain quando aplicável.
