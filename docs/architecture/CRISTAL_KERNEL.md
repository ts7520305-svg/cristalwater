# Cristal Kernel

## Missão

O Cristal Kernel é o núcleo do sistema Cristal Water.

A sua função é garantir que toda a informação da empresa nasce de uma única fonte de verdade e pode ser reutilizada por todos os módulos: operação, clientes, piscinas, técnicos, financeiro, stock, IA e conhecimento.

## Entidades base

O sistema conhece apenas estas entidades fundamentais:

1. Cliente
2. Piscina
3. Funcionário
4. Visita
5. Equipamento
6. Produto
7. Documento
8. Evento

Tudo o resto nasce da relação entre estas entidades.

## Princípios

### 1. Fonte única de verdade

Nenhuma informação deve ser duplicada.

### 2. Tudo gera eventos

Cada ação importante deve criar um evento.

Exemplos:

- CLIENT_CREATED
- POOL_CREATED
- VISIT_STARTED
- VISIT_COMPLETED
- PRODUCT_USED
- FOLLOWUP_SUGGESTED
- TECHNICIAN_DAY_STARTED
- TECHNICIAN_DAY_ENDED

### 3. A IA lê dados reais

A IA nunca inventa dados da empresa.

### 4. Todas as decisões são explicáveis

Qualquer recomendação da IA deve mostrar:

- dados usados;
- motivo;
- impacto;
- confiança;
- alternativas.

### 5. O conhecimento pertence à Cristal Water

A memória e aprendizagem da empresa ficam dentro do sistema, independentes do fornecedor de IA.

## Objetivo final

Cada visita deve tornar a próxima visita melhor.

