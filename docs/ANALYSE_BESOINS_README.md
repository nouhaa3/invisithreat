# InvisiThreat - Analyse et specification des besoins

## 2.1 Introduction
InvisiThreat est une plateforme DevSecOps qui automatise la detection des vulnerabilites dans le code et les applications en execution. L'objectif est de fournir un cycle de scan rapide, des resultats actionnables et un suivi clair pour les equipes produit et securite.

## 2.2 Analyse des besoins
Le besoin central est d'outiller les equipes pour detecter, prioriser et corriger les risques sans ralentir la livraison.

### 2.2.1 Identification des acteurs
- Admin: gouvernance, configuration, gestion des utilisateurs et roles.
- Developer: lance les scans, consulte les resultats, corrige les failles.
- Security Manager: analyse, priorise, produit des rapports.
- Viewer: acces lecture seule pour les parties prenantes.
- Systeme externe: OWASP ZAP pour DAST, CI/CD pour automatisation.

### 2.2.2 Les besoins fonctionnels
- Authentification et controle d'acces par roles (RBAC).
- Gestion des projets et des depots (connexion, configuration).
- Scans SAST via CLI et scans DAST via OWASP ZAP.
- Orchestration des scans (lancement, suivi, arret, historique).
- Normalisation des vulnerabilites (severity, recommandations).
- Reporting et export (JSON, PDF/Excel si disponible).
- API REST pour l'integration et l'automatisation.

### 2.2.3 Les besoins non fonctionnels
#### 2.2.3.1 Exigences de performance
- Temps de reponse API faible pour les actions courantes.
- Execution des scans en asynchrone pour eviter le blocage UI.
- Scalabilite pour plusieurs scans simultanes.

#### 2.2.3.2 Exigences de securite
- JWT avec rotation des tokens et expiration.
- Secrets via variables d'environnement et chiffrement si necessaire.
- Journalisation des actions sensibles et audit trail.
- Permissions minimales par role et isolation des projets.

## 2.3 Elaboration du Backlog produit
- Epics: Auth/RBAC, Gestion projets, Scans SAST/DAST, Resultats et rapports.
- Features: historique, priorisation, recommandations, export, notifications.
- Integrations: CI/CD, webhooks, GitHub.

## 2.4 Planification des sprints
- Sprint 0: base technique (API, DB, auth, CLI scan).
- Sprint 1: DAST complet et endpoints de suivi.
- Sprint 2: tableau de bord et reporting.
- Sprint 3: automatisation et integrations.

## 2.5 Analyse globale
### 2.5.1 Diagramme de cas d'utilisation global
Cas clefs: gerer utilisateurs, lancer scan, consulter resultats, generer rapport, export.

### 2.5.2 Diagramme de classe global
Classes principales: User, Role, Project, Repository, Scan, Vulnerability, Report.

## 2.6 Conclusion
Cette specification cadre les besoins essentiels d'InvisiThreat et prepare la suite du developpement autour des scans, du suivi et de la gouvernance securite.
