# Cristal Water - Preparacao VPS

Este pacote esta preparado para servidor sem apagar dados reais.

## Acesso correto no servidor

No VPS nao se abre o sistema por `localhost` no computador pessoal.

- `localhost` ou `127.0.0.1` apontam sempre para a maquina onde o browser esta aberto.
- Se o sistema estiver no VPS, o acesso deve ser pelo dominio ou IP publico do servidor.
- Exemplo direto sem Nginx: `http://IP_DO_SERVIDOR:3002`
- Exemplo recomendado com Nginx/SSL: `https://app.cristalwater.pt`

## Antes de enviar

1. Nao envie `.env`, logs, backups locais, node_modules ou ficheiros temporarios.
2. No servidor, crie o `.env` a partir de `.env.example`.
3. Use uma `JWT_SECRET` longa e unica.
4. Defina `NODE_ENV=production`.
5. Defina `PORT`, por exemplo `3002`, no `.env`.
6. Defina `CORS_ORIGIN` com o dominio publico do sistema.

## Comandos no servidor

```bash
cd /home/ubuntu/opt/cristalwater/backend
cp .env.example .env
nano .env
npm ci
npx prisma generate
npm run clean:vps
npm run check:syntax
npm run prisma:validate
npx prisma migrate deploy
npm run preflight:vps
pm2 start ecosystem.config.js --env production
pm2 save
```

## Confirmar se esta ativo no VPS

```bash
pm2 status
pm2 logs cristalwater --lines 50
curl -I http://127.0.0.1:3002/login
```

Se o `curl` responder no servidor, mas o browser exterior nao abrir, o problema esta no Nginx, firewall ou DNS.

## Nginx exemplo

```nginx
server {
    listen 80;
    server_name app.cristalwater.pt;

    location / {
        proxy_pass http://127.0.0.1:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Importante

Nao execute `npm run seed` em producao sem confirmar. Esse comando pode criar dados de exemplo.

Para atualizar sem perder dados, envie apenas codigo novo, execute migracoes com `npx prisma migrate deploy` e mantenha backups da base de dados antes de cada atualizacao.
