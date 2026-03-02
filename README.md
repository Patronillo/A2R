# A2R - Sistema de Gestão de Inventário

Sistema de gestão de inventário para aluguer de equipamentos para eventos, com gestão de entregas e recolhas.

## 🚀 Como colocar em produção (Vercel + GitHub)

Para que o projeto funcione automaticamente na Vercel ao atualizar o GitHub, siga estes passos:

### 1. Preparar o Repositório no GitHub
1. Crie um novo repositório no seu GitHub.
2. Faça o push do código para o repositório:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/SEU_UTILIZADOR/NOME_DO_REPO.git
   git push -u origin main
   ```

### 2. Configurar na Vercel
1. No painel da Vercel, clique em **"Add New" > "Project"**.
2. Importe o repositório que acabou de criar.
3. Nas **"Build and Output Settings"**, verifique se o comando de build é `npm run build` e o diretório de output é `dist`.
4. **IMPORTANTE: Variáveis de Ambiente**:
   Vá a **"Environment Variables"** e adicione as seguintes:
   - `POSTGRES_URL`: A string de ligação da sua base de dados Neon/Vercel Postgres.
   - `GEMINI_API_KEY`: A sua chave da API do Google Gemini.
   - `NODE_ENV`: `production`

### 3. Base de Dados (Vercel Postgres)
1. Se ainda não o fez, crie uma base de dados Postgres no separador **"Storage"** da Vercel.
2. Ligue (Link) a base de dados ao seu projeto. Isto injetará automaticamente as variáveis `POSTGRES_URL`, `POSTGRES_USER`, etc.

## 🛠️ Estrutura do Projeto
- `server.ts`: Servidor Express (Backend) que gere a API e a base de dados.
- `src/`: Frontend React com Tailwind CSS.
- `vercel.json`: Configuração para deployment serverless na Vercel.
- `package.json`: Gestão de dependências e scripts de build.

## 📝 Notas de Desenvolvimento
- O projeto utiliza **TypeScript** em todo o stack.
- A base de dados é **PostgreSQL** via `@vercel/postgres`.
- As animações são geridas pelo **Motion**.
- Os ícones são da biblioteca **Lucide React**.
