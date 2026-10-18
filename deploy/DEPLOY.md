# Deploy sa AWS Lightsail (Docker)

Layout sa server (`~/practicum`; kasama ang `.dockerignore` sa ugat):

```
practicum/
  backend/    <- pom.xml, src/ ...
  frontend/   <- package.json, package-lock.json, src/ ...
  deploy/     <- ang folder na ito (compose, Caddyfile, scripts)
```

## 0. Dalawang bagay na kailangang gawin sa code bago mag-build

(Na-check na ang `JwtUtil.java` at `application.properties` mo: `jwt.secret` at `jwt.expiration` ang mga property, kaya `JWT_SECRET` at `JWT_EXPIRATION` ang env names sa compose.)

1. **API URL ng frontend.** Sa `frontend/src/lib/api.ts`, palitan ang
   `baseURL: "http://localhost:8080/api"` ng `baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:8080/api"`.
   Ang web.Dockerfile ay naglalagay ng `VITE_API_URL=/api` sa production.
2. **application.properties.** Alisin ang password ng RDS at ang `jwt.secret` na nakasulat doon (tingnan ang kasamang bersyon).
   Ang compose ang nagbibigay ng lahat ng iyan sa production.

Dapat may `package-lock.json` sa frontend (kailangan ng `npm ci`) at `npm run build` ay gumagawa ng `dist/`.

## 1. Gumawa ng Lightsail instance

- Region: **Singapore (ap-southeast-1)**. Linux/Unix, **Ubuntu 24.04 LTS**, 2 GB plan ($12).
- Gumawa ng **Static IP** at i-attach sa instance (para hindi magbago ang IP).
- Tab na **Networking** -> IPv4 Firewall: bukas ang **22 (SSH)**, **80**, **443**. Limitahan ang 22 sa IP mo kung kaya.
- Tab na **Snapshots** -> i-enable ang **automatic snapshots** (araw-araw).
- Huwag gumawa nang maaga: nasisingil kada araw.

## 2. Ihanda ang server

```bash
ssh ubuntu@<STATIC-IP>
sudo apt update && sudo apt -y upgrade
# 2 GB swap para hindi maubusan ng RAM habang nagbi-build
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
# Docker (sundin ang opisyal na gabay: docs.docker.com/engine/install/ubuntu)
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ubuntu && exit   # mag-login ulit
```

## 3. Ilagay ang project

Pinakamadali: i-zip ang `backend/`, `frontend/` at `deploy/` (WALANG `node_modules`, `target`, `.env`) at `scp`:

```bash
scp practicum.zip ubuntu@<STATIC-IP>:~
ssh ubuntu@<STATIC-IP> "sudo apt -y install unzip && unzip practicum.zip -d practicum"
```

(O gumamit ng private Git repo kung meron ka.)

## 4. Mga secret

**Huwag gamitin ang lumang access key.** Gumawa ng bagong IAM user para sa app lang:

1. IAM -> Users -> Create user `practicum-app` (walang console access).
2. Permissions -> Create policy -> JSON -> idikit ang laman ng `iam-policy.json` -> i-attach sa user.
3. Security credentials -> Create access key (Application running outside AWS).
4. Ilagay ang key sa `.env` sa server lang. **Huwag i-paste sa chat o i-commit.**
5. I-delete ang lumang key na na-paste mo noon (`AKIA32OH3BT3GQTLCLKK`) at ang lumang IAM user kung hindi na kailangan.

Hindi sumusuporta ang Lightsail ng IAM role sa instance, kaya access key ang gagamitin dito. Ang policy ay limitado sa bucket mo lang.

```bash
cd ~/practicum/deploy
cp .env.example .env && chmod 600 .env
nano .env     # punan ang lahat; gumamit ng: openssl rand -base64 48
```

## 5. Unang takbo (walang laman pa ang database)

```bash
docker compose --env-file .env up -d --build
docker compose logs -f backend      # hintaying lumabas ang "Started ..." ; Ctrl+C para lumabas
```

Buksan ang `http://<STATIC-IP>`. Gagawin ng Hibernate ang mga table (`DDL_AUTO=update`). Gumana ang login? Kung walang account pa, ilipat muna ang data (sunod na hakbang).

## 6. Ilipat ang data mula sa RDS

1. Sa RDS Security Group, magdagdag ng inbound rule: MySQL/Aurora 3306 mula sa **Static IP ng Lightsail/32** lang.
2. Sa server:

```bash
cd ~/practicum/deploy
docker compose stop backend
RDS_HOST=<rds-endpoint> RDS_USER=<user> RDS_DB=<db-name> ./scripts/dump-rds.sh
./scripts/restore.sh backups/rds-YYYYMMDD-HHMM.sql.gz
docker compose start backend
```

3. Subukan nang husto: login ng coordinator at ng student, listahan ng students, pag-upload ng file (S3), pag-apply sa company, mga comment, notifications, Deployed gating.
4. Pagkatapos lang, kung maayos lahat: gumawa ng **final snapshot ng RDS** (Actions -> Take snapshot), tapos i-delete ang RDS. Tanggalin din ang rule na idinagdag mo sa Security Group.

## 7. Domain at HTTPS (kapag may domain na)

1. Sa registrar/Cloudflare DNS: A record `practicum` -> Static IP. Sa Cloudflare, gawing **DNS only** (gray cloud) muna.
2. Sa `.env`: `SITE_ADDRESS=practicum.iyongdomain.com`
3. `docker compose --env-file .env up -d` ulit. Awtomatikong kukuha ng HTTPS certificate ang Caddy (kailangang bukas ang 80 at 443).

## 8. Backup

```bash
chmod +x scripts/*.sh
./scripts/backup.sh                       # subukan muna nang isang beses
crontab -e
# idagdag:
0 19 * * * cd /home/ubuntu/practicum/deploy && ./scripts/backup.sh >> backups/backup.log 2>&1
```

- Nasa `s3://<bucket>/db-backups/`. Mag-set ng **S3 Lifecycle rule** para burahin ang `db-backups/` na mas matanda sa ~30 araw.
- **Subukan ang restore** kahit isang beses sa ibang environment bago mo ito pagkatiwalaan.
- Ang auto-snapshot ng Lightsail ay ikalawang layer, hindi kapalit ng dump.

## 9. Pag-update ng app

```bash
cd ~/practicum && (palitan ang backend/ o frontend/ files)
cd deploy && docker compose --env-file .env up -d --build
```

## 10. Bantay

- AWS Billing: budget alert (~$30) at tingnan kung bumababa ang credits sa Lightsail.
- `docker compose ps` at `docker stats` para sa RAM. Kung madalas puno ang RAM, i-upgrade sa 4 GB plan.
- `docker compose logs --tail 100 backend` kapag may error.
- I-update ang OS at ang mga image paminsan-minsan (`apt upgrade`, `docker compose pull && up -d --build`).

## Hindi pa kasama

- Mailer/verification (hiwalay na gawain).
- Presigned upload papunta sa S3 (para hindi dumaan sa backend ang mga file).
- Load test (k6) bago ang malaking launch.
