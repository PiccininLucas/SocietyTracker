# 01 - Visão Geral do Projeto (Project Overview)

## 1. Objetivo do Produto
Construir um Web App moderno, mobile-first e de alta performance para gerenciar a pelada de futebol society das quintas-feiras. O sistema substitui as anotações manuais em papel por um **Modo Mesário Digital ao Vivo** e disponibiliza rankings atualizados (artilharia, assistências, participações em gols e histórico de partidas) para a resenha do grupo via link rápido no WhatsApp.

## 2. Stack Tecnológica
* **Framework Principal:** [Astro](https://astro.build/) (Modo SSR / Serverless via `@astrojs/vercel`).
* **Arquitetura de UI:** Astro Islands (HTML SSR estático/dinâmico para páginas de consulta + Ilhas interativas em React para o Modo Mesário).
* **Estilização:** Tailwind CSS + Lucide Icons.
* **Linguagem:** TypeScript (tipagem estrita em todas as camadas).
* **Banco de Dados:** PostgreSQL hospedado no [Supabase](https://supabase.com/).
* **Hospedagem:** Vercel (Edge/Serverless Functions).
* **Padrão de Arquitetura:** Clean Architecture (Domain, Application, Infrastructure, Presentation).

## 3. Usuários e Perfis
1. **Admin / Mesário da Quadra:**
   - Monta os 4 times da noite e distribui os até 24 jogadores.
   - Opera o cronômetro de 7 minutos e registra os gols/assistências ao vivo na beira da quadra.
   - Realiza empréstimos de jogadores entre times quando necessário.
2. **Jogadores / Visitantes:**
   - Acessam links públicos sem necessidade de login para visualizar a tabela de artilharia, ranking de assistências e histórico de confrontos.

## 4. Requisitos Não-Funcionais
* **Offline-First / Resiliência de Conexão:** O cronômetro e o estado do jogo em andamento devem persistir no `localStorage` do dispositivo para evitar perda de dados por oscilação do 4G.
* **Latência Mínima de Toques:** Registrar um gol deve exigir no máximo 2 a 3 toques na tela.
* **Zero JS desnecessário:** Páginas públicas de ranking devem ser entregues em HTML puro pelo Astro.
