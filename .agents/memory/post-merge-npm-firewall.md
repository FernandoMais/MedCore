---
name: Hook pós-merge e dependências
description: Regra para manter o setup automático após merges confiável neste ambiente.
---

O setup pós-merge deve reutilizar `node_modules` quando o binário do Vite já estiver disponível, evitando uma reinstalação destrutiva em todo merge. Quando uma instalação for necessária, a resolução de `protobufjs` precisa permanecer em uma versão aceita pelo firewall de pacotes; a versão antiga bloqueada pelo ambiente faz o hook falhar antes do build.

**Why:** `npm ci` remove o diretório de dependências antes de baixar tudo. Uma falha de política durante o download deixa o workflow sem Vite e pode gerar erros transitórios de importação enquanto ele tenta se recuperar.

**How to apply:** Ao alterar o hook ou as dependências, preserve o caminho `scripts/post-merge.sh`, valide com `runPostMergeSetup` e confirme o workflow após a instalação.