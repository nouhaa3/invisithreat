# InvisiThreat - Etude technique

## 3.1 Introduction
Cette etude technique decrit l'environnement de travail, les choix technologiques et l'architecture retenue pour InvisiThreat, une plateforme DevSecOps orientee detection de vulnerabilites.

## 3.2 Environnement de travail et choix techniques
### 3.2.1 Environnement materiel
- Poste de developpement standard (CPU multi-coeurs, 16+ Go RAM recommande).
- Stockage SSD pour accelerer build et tests.
- Reseau stable pour l'execution des scans et dependances.

### 3.2.2 Environnement logiciel
- OS: Windows, Linux ou macOS.
- Backend: Python 3.12, FastAPI, SQLAlchemy, Alembic.
- Frontend: React, Vite, Tailwind CSS.
- Database: PostgreSQL 16.
- DevSecOps: Docker, Docker Compose.
- DAST: OWASP ZAP.
- Tests: Pytest.

### 3.2.3 Choix techniques
- FastAPI pour API rapide, async et documentation auto.
- PostgreSQL pour robustesse et requetes avancees.
- Docker pour portabilite et environnement reproductible.
- OWASP ZAP pour DAST open-source fiable.
- React + Vite pour une UI performante.

## 3.3 Architecture de l'application
### 3.3.1 Architecture logique
- Couche API: endpoints REST, auth, RBAC.
- Couche services: orchestration des scans, normalisation des resultats.
- Couche data: models, migrations, persistance des scans.
- Couche presentation: dashboard et consultation des vulnerabilites.

### 3.3.2 Architecture physique
- Backend FastAPI expose via HTTP.
- Base PostgreSQL en conteneur Docker.
- Service DAST s'appuie sur le daemon OWASP ZAP.
- Frontend React servi via Vite/Nginx selon l'environnement.

## 3.4 Architecture de systeme
### 3.4.0.1 Architecture Microservice
- Separation des services critiques (API, scanner, DB).
- Communication REST et files/queues si necessaire.

### 3.4.0.2 Caracteristiques de l'architecture Microservice
- Scalabilite horizontale.
- Isolation des pannes.
- Deploiement independant des composants.
- Observabilite via logs et metriques.

## 3.5 Configuration du projet
- Variables d'environnement pour secrets et config.
- Docker Compose pour lancer l'ensemble des services.
- Scripts d'installation pour Windows (setup.ps1).

## 3.6 Les bonnes pratiques
- Least privilege via RBAC.
- Secrets hors code (env, vault).
- Scans en taches asynchrones.
- Logs et audit trail pour actions sensibles.
- Tests automatises et linting.

## 3.7 Conclusion
Les choix techniques privilegient la securite, la scalabilite et la rapidite de mise en place, en coherence avec les objectifs DevSecOps d'InvisiThreat.
