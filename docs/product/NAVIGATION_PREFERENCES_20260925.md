# TASK362 — preferências de navegação por conta

## Problema e âmbito

`/admin-ui-settings` prometia temas e densidade para a plataforma inteira, mas guardava duas chaves globais sem proprietário e recarregava a página a cada escolha. O gestor antigo também escrevia valores por omissão ao abrir páginas e capturava Ctrl/Cmd+Shift+T. A navegação atual retirava as classes desse gestor; o conteúdo dos módulos usa estilos próprios, alguns ligados ao tema do dispositivo. Uma escolha guardada não comprovava um efeito visual uniforme.

A página passa a apresentar **preferências da navegação administrativa**: barra superior, menu lateral, gaveta e menu inferior. O próprio ecrã de preferências acompanha as cores para permitir a revisão. Os ecrãs de trabalho conservam os respetivos estilos. O âmbito aparece antes dos controlos e não se declara tema ou densidade universal da aplicação.

## Alteração

- Três escolhas de cor: dispositivo, claro e escuro. O modo dispositivo acompanha alterações do sistema durante a sessão; as escolhas fixas mantêm-se. Três níveis de espaçamento modificam efetivamente os grupos e as ligações. O modo amplo aumenta também os controlos superiores; o compacto conserva alvos de toque de pelo menos 44 px.
- A pré-visualização mostra a escolha em edição. **Guardar e aplicar** confirma a escrita e a leitura do registo antes de aplicar o resultado, sem recarga ou pedido à API. O resumo mostra a configuração em utilização. Repor predefinições remove apenas o registo válido da conta atual.
- Registo versionado por ADMIN e navegador; não há sincronização entre dispositivos. Abertura, tema do sistema e mudança de idioma não gravam valores por omissão. Tokens/identidades incompatíveis, sessão alterada ou expirada e ENV_ADMIN não permitem editar a preferência.
- As duas chaves antigas e o tema do ecrã técnico clássico são preservados. As opções globais antigas não são importadas para uma conta. Nas páginas com navegação atual, o gestor antigo deixa de escrever essas chaves e de capturar o atalho do navegador; a ajuda e o comando rápido continuam disponíveis.
- Alterações detetadas noutra janela conservam o rascunho visível e exigem carregar a escolha guardada antes de editar. A gravação compara também os bytes atuais com os que foram revistos. Isto não é uma transação distribuída entre janelas. Falhas de quota, escritas ignoradas e registos ilegíveis têm estados próprios; bytes ilegíveis são conservados e a edição fica bloqueada. Troca de conta e suspensão limpam os controlos visíveis e o aspeto associado à sessão anterior.
- Conteúdo próprio em PT/EN/FR/ES/DE; idioma conservado nos destinos menu/índice/centro. O menu comum mantém as traduções do seu âmbito anterior. As novas variáveis CSS estão limitadas à navegação; não alteram as variáveis de negócio, as cores de painéis do catálogo ou os seus filtros.

## Validação

**720 testes unitários em 99 ficheiros**, incluindo dez novos, e quatro testes técnicos. Verificação de sintaxe: 642 ficheiros backend, 254 frontend e 45 scripts inline. Verificações dirigidas de sintaxe e modelo foram repetidas após os ajustes finais de texto e navegação. Não há alterações de backend, dependências, esquema ou migrações neste lote.

Quatro grupos distintos de integração aprovados: preferências, navegação comum, ajuda por perfil e catálogo administrativo. O grupo novo usa páginas reais de preferências/menu/índice/ajuda e comprova persistência por conta, ausência de recarga, sistema claro/escuro em tempo real, escolhas fixas, três densidades, contraste das ligações e do texto de pesquisa de pelo menos 4,5:1, cinco idiomas, três larguras, filtros/cores do catálogo conservados, atalho antigo libertado, duas janelas, quota/escrita ignorada, bytes ilegíveis/proprietário incorreto, suspensão/regresso, reposição, gravação offline e troca/expiração da sessão. Zero escritas de negócio e contagens de clientes/piscinas/visitas/documentos/pagamentos/mensagens inalteradas. O grupo foi repetido depois da revisão visual e do ajuste do contraste do campo de pesquisa.

A navegação comum passou oito páginas em quatro larguras, incluindo foco da gaveta, pesquisa, teclado e estado offline. A ajuda passou ADMIN/CLIENT/TECHNICIAN/TEAM_LEADER e cinco idiomas. O catálogo passou os dois ecrãs, 68 entradas, 67 destinos distintos, seis âncoras, pesquisa/filtros/recarga/sessão e oito casos de guarda. Os ensaios de navegação isolam os scripts de negócio; não constituem uma auditoria funcional completa de cada módulo.

Trinta e três capturas próprias em `reports/field-visual/navigation-preferences/`: 30 combinações de idioma/paleta/largura e três densidades no menu lateral. Revistos PT claro 390, PT escuro 1440, DE escuro 320 e navegação ampla. Os controlos surgem antes das notas históricas no telemóvel. Dois recursos binários continuam não materializados localmente; não se declara perfeição visual global nem teste físico iPhone/Android.

Runtime PGlite isolado, 41 migrações existentes e Chromium em múltiplos processos com segurança web ativa. Cache **v173**, runner com **260 grupos distintos**. Inventário: 115 HTML, 100 páginas com referência literal em 281 scripts ativos, 15 na fila de pesquisa e zero recursos ausentes do repositório. Referência literal não certifica um módulo.

## CI e publicação

TASK361 confirmada em [259/259 grupos no PostgreSQL nativo](evidence/20260925_task361_ci.json), 17 etapas e 40m52s. As duas regressões que tinham falhado localmente passaram sem alteração dos testes. A atualização de 41 migrações e o restauro de 127 tabelas/47 ficheiros passaram, com linhas e hashes iguais. O registo da TASK361 foi atualizado com esta resolução.

Publicada em `c2be6caa8649e1d7ab3fc47aef29d5f85c07ac49`, árvore `5644d9f38dd223926a191e3b036bc511d6d7b31c`, idêntica à preparada e validada localmente. [CI 36150863744](https://github.com/ts7520305-svg/cristalwater/actions/runs/36150863744), job `108123470461`, aprovado: 260/260 grupos esperados distintos, 17 etapas, 41 migrações e restauro de 127 tabelas/47 ficheiros com linhas e hashes iguais, em 42m54s. [Evidência nativa](evidence/20260925_task362_ci.json).

## Retoma

CI/restauro deste lote confirmados. Retomar os HTML restantes da fila (15 no inventário deste lote), começando pela inspeção de fornecedores e preservação dos dados existentes. As preferências deste lote cobrem a navegação de ADMIN; interfaces clássicas e temas próprios dos módulos mantêm âmbito separado. Registos ilegíveis não são reparados automaticamente. Conciliação histórica, volume de produção, infraestrutura/VPS, cópias operacionais, fornecedores externos e piloto físico continuam pendentes. Sem merge, deploy ou contactos reais; aplicação não declarada completa.
