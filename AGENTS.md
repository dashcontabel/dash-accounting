# AGENTS.md

## Instrucoes para Agentes de Desenvolvimento

Este projeto possui uma base de conhecimento criada para orientar agentes de IA e desenvolvedores.

Antes de implementar qualquer alteracao:

1. Leia `docs/AI_CONTEXT_SUMMARY.md`.
2. Consulte `docs/AI_PROJECT_KNOWLEDGE_BASE.md` quando precisar de mais contexto.
3. Entenda o padrao existente antes de criar codigo novo.
4. Implemente a menor alteracao segura possivel.
5. Crie ou atualize testes unitarios.
6. Rode os testes disponiveis.
7. Atualize a base de conhecimento quando houver mudanca relevante.
8. Nao exponha secrets ou dados sensiveis.
9. Nao introduza dependencias sem justificativa.
10. Mantenha consistencia com a arquitetura atual.

---

## Regras Obrigatorias

- Toda feature deve respeitar os padroes existentes.
- Toda regra de negocio nova deve ser documentada.
- Todo bugfix relevante deve ter teste de regressao quando possivel.
- Toda alteracao de banco deve ser documentada.
- Toda alteracao de autenticacao ou autorizacao deve ser revisada com atencao.
- Toda nova rota protegida deve validar permissao no backend.
- Todo codigo novo deve ser testavel.
- Nao usar Canvas para documentacao do projeto.
- Toda documentacao criada deve ficar em arquivos `.md`.

---

## Prioridade

A prioridade e entregar codigo:

- Seguro
- Testavel
- Simples
- Consistente
- Alinhado ao dominio
- Facil de manter
- Bem documentado para agentes de IA

---

## Atualizacao da Base de Conhecimento

Sempre que uma alteracao relevante for feita, atualize:

```bash
docs/AI_PROJECT_KNOWLEDGE_BASE.md
```

E, se o resumo rapido for impactado, atualize tambem:

```bash
docs/AI_CONTEXT_SUMMARY.md
```

A base de conhecimento deve evoluir junto com o codigo.

---

## Testes

Sempre que implementar nova feature, correcao ou refatoracao relevante:

1. Criar ou atualizar testes unitarios.
2. Rodar os testes disponiveis.
3. Corrigir falhas relacionadas a alteracao.
4. Nao ignorar falhas.
5. Documentar limitacoes caso o projeto ainda nao tenha estrutura de testes suficiente.

---

## Comportamento Esperado

O agente deve agir como um desenvolvedor senior.

Nao deve:

- Inventar regras de negocio.
- Criar padroes novos sem necessidade.
- Refatorar grandes areas sem justificativa.
- Ignorar testes.
- Ignorar seguranca.
- Alterar schema sem avaliar impacto.
- Expor secrets.
- Gerar documentacao fora dos arquivos Markdown.
- Usar Canvas.

Deve:

- Ler o projeto real.
- Seguir o padrao existente.
- Criar codigo limpo.
- Criar testes.
- Atualizar documentacao.
- Registrar pendencias quando algo nao estiver claro.
