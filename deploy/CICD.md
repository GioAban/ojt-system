# CI/CD: push sa GitHub, awtomatikong ma-update ang live site

```
laptop --git push main--> GitHub Actions --build images--> ghcr.io
                                   |
                                   +--ssh--> Lightsail: pull images + restart (walang build sa server)
```

Bakit hindi sa server nagbi-build: 2 GB lang ang RAM, at mabigat ang Maven at npm build. Sa GitHub ang build (libre), ang server ay taga-pull at taga-run lang. Mga 1 hanggang 2 minuto ang bawat update.

Ang docker-compose sa laptop mo ay gumagana pa rin gaya ng dati (`docker compose up --build`). Ang `docker-compose.prod.yml` ay para lang sa server.

## A. Isang beses lang: GitHub

1. Gumawa ng **private** repo sa GitHub (halimbawa `practicum`).
2. Sa `D:\\practicum`, i-extract ang bundle na ito (may `.gitignore`, `.github/`, `deploy/`).
3. Siguraduhing hindi mapupunta sa Git ang secrets:
   ```powershell
   cd D:\\practicum
   git status --short
   ```
   Hindi dapat lumabas ang `.env`, `.vscode/` o `target/`. Kung may `application.properties` na may password, gamitin ang bagong bersyon (wala nang password).
4. Kung may Git repo na:
   ```powershell
   git add .
   git commit -m "Add Docker deploy and CI/CD"
   git branch -M main
   git remote add origin https://github.com/<username>/practicum.git
   git push -u origin main
   ```
5. Sa GitHub: **Settings, Actions, General**, tingnan na **Allow all actions** ay naka-on, at ang Workflow permissions ay **Read and write**.

## B. Isang beses lang: SSH key para sa deploy

Sa laptop (PowerShell):
```powershell
ssh-keygen -t ed25519 -f $HOME\\.ssh\\practicum_deploy -C "github-actions" -N '""'
```
Dalawang file ang gagawin: `practicum_deploy` (private) at `practicum_deploy.pub` (public).

1. Idagdag ang **public** key sa server (SSH ka muna sa Lightsail gamit ang karaniwan mong key):
   ```bash
   echo "<laman ng practicum_deploy.pub>" >> ~/.ssh/authorized_keys
   ```
2. Kunin ang host key ng server (para hindi madaya ang koneksyon):
   ```powershell
   ssh-keyscan -t ed25519 <IP ng Lightsail>
   ```
   Kopyahin ang buong linyang lalabas.

## C. Isang beses lang: GitHub Secrets

Repo, **Settings, Secrets and variables, Actions, New repository secret**. Idagdag:

| Name | Value |
|---|---|
| `LIGHTSAIL_HOST` | static IP ng server (o ang domain) |
| `LIGHTSAIL_USER` | `ubuntu` |
| `LIGHTSAIL_SSH_KEY` | buong laman ng `practicum_deploy` (private), kasama ang BEGIN at END na linya |
| `LIGHTSAIL_HOST_KEY` | ang linyang galing sa `ssh-keyscan` |

Pwede mo ring gumawa ng **Environment** na `production` (Settings, Environments) at lagyan ng "Required reviewers" kung gusto mong may click-to-approve bago mag-deploy.

## D. Isang beses lang: ihanda ang server

Sundan ang DEPLOY.md hanggang sa magkaroon ng `~/practicum/deploy/.env`. Dagdag na tatlong bagay:

1. Siguraduhing may `rsync` at Docker:
   ```bash
   sudo apt-get install -y rsync
   ```
2. Idagdag sa dulo ng `~/practicum/deploy/.env` (palitan ang `username` ng GitHub username mo, lowercase):
   ```
   IMAGE_PREFIX=ghcr.io/username/practicum
   ```
3. Huwag mo nang patakbuhin ang `docker compose up --build` sa server. Ang unang deploy ay mangyayari sa unang push sa `main`.

## E. Araw-araw na gamit

```powershell
git add .
git commit -m "Ayusin ang DTR"
git push
```
Tingnan ang progreso sa GitHub, tab na **Actions**. Pag berde, live na.

- **Pull request:** nagbi-build lang (tinitingnan kung pumapasa), hindi nagde-deploy.
- **Manual na deploy:** Actions, "Build and deploy", **Run workflow**.

## F. Rollback kapag may sira

May tag ang bawat image na galing sa commit (12 characters). Sa server:
```bash
cd ~/practicum/deploy
cat .deploy-history          # listahan ng mga na-deploy
export IMAGE_PREFIX=ghcr.io/username/practicum IMAGE_TAG=<lumang-tag>
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml up -d --no-build
```
O i-revert ang commit sa Git at mag-push (mas simple, may audit trail).

## G. Mga babala

- **Database:** `ddl-auto=update` ang gamit, kaya kusang dinadagdag ang mga bagong column at table. Hindi nito binubura ang luma at hindi nito inaayos ang mga rename. Bago ang malaking pagbabago sa schema, patakbuhin muna ang `scripts/backup.sh`.
- **Downtime:** may ilang segundo (mga 10 hanggang 20) na hindi maaabot habang nagre-restart ang backend. Maiiwasan ito sa susunod, pero sapat na ito para sa ngayon.
- **Secrets:** nasa GitHub Secrets at sa `.env` ng server lang ang mga ito. Huwag i-commit ang kahit anong key o password.
- **Public repo:** kapag ginawa mong public ang repo, tiyaking walang secret sa Git history.
