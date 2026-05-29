# Instructions de développement pour l'IA (CLAUDE.md)

Ce fichier définit les directives de développement, les commandes de build, les processus de validation et le flux de déploiement à respecter obligatoirement lors des interventions sur le projet **Playbox**.

---

## 📋 Processus de validation obligatoire

Après chaque étape majeure ou modification de logique, vous devez **impérativement** exécuter et valider les étapes suivantes :

### 1. Tests de compilation
Assurez-vous qu'il n'y a aucune erreur de type TypeScript dans aucun des projets :
* **Frontend** :
  ```bash
  cd frontend && npx tsc -p tsconfig.app.json --noEmit
  ```
* **Backend** :
  ```bash
  cd backend && npx tsc --noEmit
  ```
* *Alternative globale* : Si la machine n'a pas Docker actif, assurez-vous au moins de valider les commandes `npm run build` dans chaque sous-dossier (`frontend/`, `backend/`, `shared/`).

### 2. Rebuild local sans cache (Docker Compose)
Validez le fonctionnement de l'infrastructure multi-services en local avec le Compose de dev :
```bash
docker compose build --no-cache
docker compose up -d
```
Vérifiez que tous les conteneurs démarrent sans crash (`docker compose ps` / `docker compose logs`).

### 3. Build de l'image Monolithique de production
Le projet utilise une image monolithique combinant Nginx (frontend) et Node.js (backend) sur le port 80. Validez sa compilation :
```bash
docker build -t mrcryllix/playbox:latest .
```

---

## 🚀 Flux de livraison et déploiement

Une fois les modifications validées localement, suivez ce flux pour publier les mises à jour :

### 1. Publication sur Docker Hub
Poussez la nouvelle version stable de l'image monolithique sur le compte utilisateur :
```bash
docker push mrcryllix/playbox:latest
```

### 2. Enregistrement des sources (Git)
Faites toujours un commit local et poussez-le sur la branche distante active (`master`) :
```bash
git add .
git commit -m "votre message de commit explicite (ex: fix(pong): ...)"
git push origin master
```
*⚠️ Attention : Ne commitez jamais d'identifiants en clair (clés privées, IP publiques de prod, secrets de session). Utilisez toujours des valeurs génériques ou des placeholders.*

---

## 🛠️ Commandes utiles de référence

### Lancer la stack complète en local
* Démarrer : `docker compose up -d`
* Arrêter : `docker compose down`
* Logs en continu : `docker compose logs -f`

### Build individuel des paquets
* **Shared** : `cd shared && npm run build`
* **Backend** : `cd backend && npm run build`
* **Frontend** : `cd frontend && npm run build`
