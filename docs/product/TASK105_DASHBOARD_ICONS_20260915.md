# TASK105 — Ícones administrativos sem dependência de fontes

A revisão das imagens reais encontrou quadrados vazios no lugar dos quatro emojis dos indicadores administrativos quando o ambiente não tinha uma fonte emoji compatível.

Os indicadores de alertas, visitas, técnicos e pendências passam a usar desenhos SVG locais de 24 px, com contorno `currentColor`. Não precisam de rede nem de fontes do sistema. São decorativos (`aria-hidden="true"`, `focusable="false"`); os cartões conservam os nomes acessíveis e o texto visível dos indicadores.

O teste visual com servidor real exige quatro SVG decorativos dentro de `#metrics`, sem conteúdo textual emoji nos respetivos elementos. As contagens, destinos e regras dos indicadores não foram modificados.
