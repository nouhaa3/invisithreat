# Prompt GitHub Copilot — Correction et complétion du rapport PFE InvisiThreat

## Contexte du projet

Tu travailles sur le rapport de PFE (Projet de Fin d'Études) de la plateforme **InvisiThreat**, une solution DevSecOps de détection automatisée de vulnérabilités par analyses SAST et DAST.  
- **Établissement :** ISIMS Sfax — Diplôme Ingénieur en Informatique, Spécialité Génie Logiciel  
- **Auteurs :** Nouha BOUGHNIM et Wiem BZIOUICH  
- **Encadrante académique :** Mme Najiba TAGOUGUI  
- **Encadrant professionnel :** M. HoussemEddine HASSAYOUNE (Mobelite)  
- **Année universitaire :** 2025–2026

### Stack technique réelle de l'application
| Composant | Technologie |
|-----------|-------------|
| Backend API | Python / FastAPI (asynchrone, Pydantic v2) |
| Frontend | React + Vite + Tailwind CSS |
| Base de données | PostgreSQL (SQLAlchemy ORM, Alembic migrations) |
| File de messages | Redis (Celery broker) |
| Orchestration async | Celery workers |
| Temps réel | Socket.IO (python-socketio) |
| SAST | Semgrep + Bandit |
| DAST | OWASP ZAP (API REST daemon) |
| IA / LLM | Ollama (modèles Mistral/Qwen) — action "Assist with AI" |
| Auth | JWT (access 30 min + refresh token), TOTP 2FA, RBAC |
| Intégration | GitHub OAuth, clés API (UserAPIKey), CLI scanner |
| Conteneurisation | Docker / Docker Compose |

### Modèles de données réels (SQLAlchemy)
- **User** : id, nom, email, hashed_password, is_active, is_verified, totp_secret, totp_enabled, role_id, trial_scans_remaining
- **Role** : id, name (admin / developer / security_manager / viewer)
- **Project** : id, name, description, owner_id, language (enum), analysis_type (enum), visibility (enum)
- **ProjectMember** : id, project_id, user_id, role (owner/member/viewer)
- **GitHubRepository** : id, project_id, encrypted_token, repo_url, default_branch
- **Scan** : id, project_id, method (cli/github/dast/exe), status (pending/running/completed/failed), job_state, created_at
- **Vulnerability** : id, scan_id, title, description, severity (critical/high/medium/low/info), status (open/in_progress/resolved/false_positive/risk_accepted), cvss_score
- **VulnerabilityTask** : id, project_id, scan_id, fingerprint, title, severity, status (open/in_progress/fixed/verified), assignee_id, due_date
- **VulnerabilityTaskComment** : id, task_id, author_id, content, created_at
- **RiskScore** : id, scan_id, score, level
- **Recommendation** : id, vulnerability_id, explanation, fix_example, cwe_reference
- **AuditLog** : id, user_id, action, resource_type, resource_id, timestamp
- **AuthToken** : id, user_id, token_hash, expires_at, revoked
- **UserAPIKey** : id, user_id, key_hash, name, is_active, last_used_at
- **Notification** : id, user_id, type, message, is_read, created_at
- **SecurityReport** : id, scan_id, project_id, generated_at, data (JSON)

---

## Structure du rapport à respecter (basée sur le rapport de référence)

Le rapport de référence suit cette organisation par chapitre/sprint :

```
Chapitre N : Sprint X – [Titre du sprint]
  1. Introduction
  2. Objectif attendu et identification des tâches
     2.1 Objectif attendu
     2.2 Backlog de sprint (tableau ID / User Story / ID Task / Task)
  3. Technologies et concepts utilisés
     (sous-sections avec logo + description + justification)
  4. Analyse et spécification des besoins
     4.1 Diagramme de cas d'utilisation du sprint
     4.2 Description détaillée des cas d'utilisation
         (tableaux : Titre / Acteur / Résumé / Préconditions / Postconditions /
          Scénario nominal / Scénario alternatif)
  5. Modélisation conceptuelle
     5.1 Diagramme de classes + dictionnaire de données (tableau Classes/Codes/Désignation/Types)
     5.2 Diagrammes de séquence
         (un diagramme par cas d'utilisation principal avec notation BCE :
          Boundary/Control/Entity — style du rapport de référence)
  6. Réalisation
     (captures d'écran des interfaces avec descriptions)
  7. Test et validation
     7.1 Tests (tableau Cas de Test / Auteur / Description / Précondition / Scénario / Postcondition)
     7.2 Validation
     7.3 Commits (mention du versioning Git/GitHub)
  8. Conclusion
```

---

## Erreurs, incohérences et manques à corriger

### 1. Erreurs structurelles graves

**[ERREUR] Sections 3.8.1 et 3.8.2 mal placées (Chapitre 3 – Sprint 1)**  
Les sous-sections `3.8.1 Diagramme IA/LLM` et `3.8.2 Diagramme d'activités` apparaissent dans la *conclusion* du Sprint 1. Ces diagrammes n'ont rien à voir avec l'authentification. Le LLM appartient au Sprint 4 (DAST + IA) et le diagramme d'activités général devrait être dans le Sprint 0.  
→ **Action :** Supprimer ces deux sous-sections du Sprint 1. Replacer le diagramme d'activités dans Sprint 0 (section 2.5 ou 2.6) et le diagramme LLM dans Sprint 4 (section 6.4.2 ou 6.5.2).

**[ERREUR] Double numérotation "3.11 Conclusion" dans le Chapitre 3**  
Il y a deux sections "3.11 Conclusion" dans le Chapitre 3.  
→ **Action :** Supprimer la deuxième. Les sections 3.9 (Configuration du projet) et 3.10 (Bonnes pratiques) doivent être soit supprimées, soit déplacées en annexe ou en Sprint 0 (étude technique).

**[ERREUR] Sections 3.9 et 3.10 incohérentes avec la structure**  
"Configuration du projet" et "Bonnes pratiques" ne font pas partie de la structure sprint standard. Le rapport de référence ne les inclut pas dans les chapitres sprint.  
→ **Action :** Supprimer ces sections du Chapitre 3. Intégrer le contenu pertinent (variables d'environnement, secrets, Docker Compose) dans Sprint 0 section 2.5.3 (Technologies et outils).

**[ERREUR] Titre incorrect "Sprint 3 – SAST" alors que le sprint couvre SAST + DAST**  
Le Chapitre 5 s'intitule "Sprint 3 – SAST" mais selon la planification réelle des sprints (Tableau 2.5), Sprint 3 couvre uniquement SAST. Sprint 4 couvre "DAST, orchestration et IA". Cette séparation est cohérente.  
→ **Action :** Conserver la séparation mais s'assurer que Sprint 3 parle *uniquement* de SAST (Semgrep, Bandit, normalisation, CLI) et que Sprint 4 parle de DAST (OWASP ZAP, Celery/Redis, Socket.IO, scoring de risque, workflow vulnérabilités, LLM). Le titre du Chapitre 6 doit devenir **"Sprint 4 – DAST, Orchestration et IA"** incluant aussi le workflow vulnérabilités.

**[ERREUR] Sprint 4 incomplet dans le rapport**  
Le Chapitre 6 (Sprint 4) contient la gestion du workflow de vulnérabilités (VulnerabilityTask, assignation, statuts, commentaires) mais cette fonctionnalité n'est pas mentionnée clairement dans les objectifs ni dans le backlog de sprint.  
→ **Action :** Ajouter au Sprint Backlog du Sprint 4 les user stories manquantes : workflow de vulnérabilités (états, assignation, commentaires), scoring de risque, notifications temps réel.

---

### 2. Contenu "placeholder" à remplacer par du vrai contenu

Chaque sprint contient des figures "placeholder" à remplacer par de vraies descriptions UML. La structure attendue par le jury est la suivante (basée sur le rapport de référence) :

**Chapitre 3 – Sprint 1 (Sécurité et gouvernance)**
- Figure 3.1 → Diagramme de cas d'utilisation Sprint 1 : acteurs (Utilisateur, Admin), cas (S'authentifier, Gérer rôle RBAC, Activer 2FA, Consulter audit logs)
- Figure 3.2 → Diagramme de classes Sprint 1 : classes User, Role, AuthToken, AuditLog avec attributs réels du modèle
- Figure 3.3 → **Deux** diagrammes de séquence :
  1. "S'authentifier" (login JWT + TOTP optionnel) — notation BCE : LoginPage (boundary) → AuthController (control) → User, AuthToken (entity) → PostgreSQL
  2. "Attribution de rôle" — AdminPanel (boundary) → AuthController (control) → User, AuditLog (entity)
- Ajouter **Tableau de description** pour chaque cas d'utilisation (Titre/Acteur/Résumé/Préconditions/Postconditions/Scénario nominal/Scénario alternatif)
- Ajouter **Dictionnaire de données** du diagramme de classes (colonnes : Classe / Code / Désignation / Type)
- Ajouter **Tableau de test** pour "S'authentifier" et "Attribuer un rôle"
- Ajouter section **7.3 Commits** avec mention des branches git utilisées

**Chapitre 4 – Sprint 2 (Projets et intégrations)**
- Figure 4.1 → Diagramme de cas d'utilisation Sprint 2 : acteurs (Developer, Admin), cas (Créer projet, Connecter dépôt GitHub, Générer clé API, Ajouter membre)
- Figure 4.2 → Diagramme de classes Sprint 2 : classes Project, GitHubRepository, ProjectMember, UserAPIKey avec attributs réels
- Figure 4.3 → **Deux** diagrammes de séquence :
  1. "Créer un projet" — ProjectForm (boundary) → ProjectController (control) → Project, ProjectMember (entity)
  2. "Connecter dépôt GitHub" — GitHubForm (boundary) → ProjectController (control) → EncryptionService (control) → GitHubRepository (entity) — *montrer le chiffrement du token*
- Ajouter tableaux de description UC, dictionnaire de données, tableau de test

**Chapitre 5 – Sprint 3 (SAST)**
- Figure 5.1 → Diagramme de cas d'utilisation Sprint 3 : Developer lance scan SAST, Security Manager consulte alertes normalisées
- Figure 5.2 → Diagramme de classes Sprint 3 : classes Scan, Vulnerability, ScanTool avec attributs réels + enums ScanMethod, ScanStatus, VulnerabilitySeverity
- Figure 5.3 → **Deux** diagrammes de séquence :
  1. "Lancer un scan SAST" — ScanForm (boundary) → ScanController (control) → Scan (entity) → Redis Queue → CeleryWorker (control) → Vulnerability (entity)
  2. "Suivi temps réel Socket.IO" — ScanProgressUI (boundary) → SocketIOGateway (control) → CeleryWorker (control)
- Ajouter tableaux de description UC, dictionnaire de données, tableau de test

**Chapitre 6 – Sprint 4 (DAST, Orchestration et IA)**
- Figure 6.1 → Diagramme de cas d'utilisation Sprint 4 : lancer DAST, workflow vulnérabilités, recommandation IA, générer rapport
- Figure 6.2 → Diagramme de classes Sprint 4 : classes RiskScore, VulnerabilityTask, VulnerabilityTaskComment, Recommendation, Notification, SecurityReport
- Figure 6.3 → **Trois** diagrammes de séquence :
  1. "Lancer scan DAST (OWASP ZAP)" — DASTScanForm (boundary) → ScanController (control) → CeleryWorker (control) → OWASP ZAP (collections) → RiskScore (entity)
  2. "Workflow vulnérabilité" — VulnerabilityPanel (boundary) → VulnWorkflowController (control) → VulnerabilityTask, Notification (entity)
  3. "Recommandation IA" — VulnDetailPanel (boundary) → LLMController (control) → LLMAdapter/Ollama (control) → Recommendation (entity)
- Ajouter tableaux de description UC, dictionnaire de données, tableau de test

---

### 3. Tableaux de description UC manquants — format exact attendu

Pour **chaque cas d'utilisation** de chaque sprint, produire un tableau selon ce modèle :

```
Titre          : [Nom du cas d'utilisation]
Acteur         : [Rôle(s) impliqué(s)]
Résumé         : [Ce que le cas d'utilisation permet]
Préconditions  : [Ce qui doit être vrai avant]
Postconditions : [Ce qui est vrai après]
Scénario nominal :
  1. [Étape 1 — acteur]
  2. [Étape 2 — système]
  ...
Scénario alternatif :
  N.a [Condition d'erreur] → [Message/Comportement]
```

---

### 4. Dictionnaires de données manquants — format exact attendu

Pour chaque diagramme de classes de sprint, produire un tableau :

| Classe | Code | Désignation | Type |
|--------|------|-------------|------|
| User | id | Identifiant unique UUID | UUID |
| User | nom | Nom complet de l'utilisateur | String |
| ... | ... | ... | ... |

Utiliser **uniquement les attributs réels** des modèles SQLAlchemy listés ci-dessus.

---

### 5. Tableaux de test manquants — format exact attendu

Pour chaque sprint, un tableau de test pour le cas d'utilisation principal :

| Champ | Valeur |
|-------|--------|
| Cas de Test | [Nom] |
| Auteur du cas de test | [Rôle acteur] |
| Description | [Ce que le test vérifie] |
| Précondition | [Conditions initiales] |
| Scénario | 1. [...] 2. [...] |
| Postcondition | [Résultat attendu] |

---

### 6. Section Technologies par sprint — format exact attendu

Suivre le format du rapport de référence (Logo + Description + Justification) pour chaque technologie *nouvelle* introduite dans le sprint :

- **Sprint 1 :** JWT (python-jose), FastAPI Security (OAuth2PasswordBearer), pyotp (TOTP), bcrypt
- **Sprint 2 :** GitHub REST API v3, cryptography (Fernet — chiffrement du token GitHub), SQLAlchemy Alembic
- **Sprint 3 :** Semgrep (analyse polyglotte par règles), Bandit (inspection Python), Celery (orchestration async), Redis (broker)
- **Sprint 4 :** OWASP ZAP (API REST daemon), python-socketio (Socket.IO), Ollama (LLM local), ReportLab ou WeasyPrint (génération PDF)

---

### 7. Incohérences mineures à corriger

| N° | Localisation | Problème | Correction |
|----|-------------|----------|------------|
| 1 | Chapitre 3 intro Sprint 1 | "RBAC pour les rôles Admin, Security Manager, Développeur et Viewer" — le rôle dans le code est `developer` (pas "Développeur") | Harmoniser avec les vrais noms d'enum : `admin`, `developer`, `security_manager`, `viewer` |
| 2 | Tableau 2.5 Sprint 3 | "Intégration Semgrep et Bandit, règles regex internes, CLI scanner, normalisation des alertes" — les règles regex font partie de l'interface mais pas du modèle de données | Préciser que les règles regex sont configurables via l'interface de scan (paramètre `custom_rules` de la requête POST /scans) |
| 3 | Tableau 2.5 Sprint 4 | "workers Celery/Redis" sont présents dès Sprint 3 (SAST utilise déjà Celery) | Reformuler Sprint 3 pour mentionner l'infrastructure Celery/Redis et Sprint 4 pour l'*extension* DAST + scoring |
| 4 | Section 3.3.1 | "L'authentification repose sur des jetons JWT signés côté serveur, avec un mécanisme de rafraîchissement contrôlé" — vrai mais incomplet | Ajouter : durée access token = 30 min, refresh token stocké en `auth_tokens`, révocable, invalidation sur logout |
| 5 | Section 3.3.2 | "TOTP ajoute un facteur de sécurité basé sur des codes temporaires" — vrai mais manque la bibliothèque | Ajouter : implémenté avec `pyotp` (RFC 6238), compatible Google Authenticator et Authy |
| 6 | Sprint Backlog Sprint 4 (Tableau 6.1) | S4-04 "recommandation via assistant IA" priorité S (should) — mais l'IA est centrale au projet | Changer la priorité en M (Must have) — c'est une fonctionnalité différenciatrice majeure |
| 7 | Introduction Générale | "l'action Assist with AI" mentionnée sans explication du LLM local | Ajouter une phrase : "Ce module fonctionne via Ollama, un serveur d'inférence local supportant les modèles Mistral et Qwen, garantissant la confidentialité totale du code analysé." |
| 8 | Section 1.3.1 | "DAST (Dynamic Application Security Testing)" correct mais "À ces trois dimensions s'ajoute un assistant IA" — il n'y a que deux dimensions SAST/DAST mentionnées avant | Corriger : "À ces deux familles d'analyses s'ajoute un assistant IA..." |
| 9 | Section 2.4.1.3 Tableau 2.2 | US 8.1 — "Clés API" — la description mentionne "système CI/CD" comme acteur mais dans le modèle c'est le User qui génère la clé | Préciser : "En tant que développeur/admin, je veux générer une clé API afin d'authentifier les appels depuis un pipeline CI/CD sans exposer mes identifiants." |
| 10 | Section 2.5.3 Tableau 2.8 | Ligne Socket.IO incomplète (coupée à "La gestion des connexions...") | Compléter : "...représentent les contraintes principales. La salle Socket.IO est scopée par scan_id pour éviter les émissions croisées entre projets." |
| 11 | Chapitre 5 Sprint 3 — Sprint Backlog S3-02 | "En tant que développeur, je peux analyser les dépendances du projet" — pas dans les fonctionnalités réelles du modèle | Remplacer par : "En tant que développeur, je peux consulter le rapport SAST normalisé filtré par sévérité." — cohérent avec `VulnerabilitySeverity` enum |
| 12 | Conclusion Générale | Manque de mention des vrais résultats techniques (nombre de modèles de données, endpoints, couverture de tests) | Ajouter des données chiffrées réelles issues du projet |

---

### 8. Conclusion Générale — contenu attendu

La conclusion doit mentionner :
1. **Bilan technique réel :** pipeline SAST/DAST opérationnel, N modèles SQLAlchemy, M endpoints FastAPI, workers Celery avec Redis, interface React temps réel Socket.IO
2. **Différenciateur IA :** assistant LLM local (Ollama) préservant la confidentialité du code — avantage vs solutions SaaS
3. **Gouvernance :** RBAC 4 rôles, TOTP 2FA, audit logs complets, chiffrement des tokens GitHub (Fernet)
4. **Perspectives concrètes :**
   - Intégration CI/CD complète avec security gates (bloquer merge si CRITICAL détecté)
   - Extension vers l'analyse d'images Docker (Trivy) et Infrastructure as Code (Checkov)
   - Intégration ticketing Jira / GitHub Issues pour synchroniser le workflow de vulnérabilités
   - Multi-tenant avec isolation par organisation
   - Fine-tuning du modèle LLM sur des données de vulnérabilités spécifiques au domaine

---

### 9. Bibliographie — références réelles à inclure

```
[1] OWASP Foundation, "OWASP Top Ten", https://owasp.org/www-project-top-ten/, 2021.
[2] OWASP Foundation, "OWASP ZAP", https://www.zaproxy.org/, 2024.
[3] Semgrep, "Semgrep Static Analysis Tool", https://semgrep.dev/, 2024.
[4] Python Software Foundation, "Bandit Security Linter", https://bandit.readthedocs.io/, 2024.
[5] Tiangolo S., "FastAPI Framework", https://fastapi.tiangolo.com/, 2024.
[6] Celery Project, "Celery: Distributed Task Queue", https://docs.celeryq.dev/, 2024.
[7] Ollama, "Run Llama, Mistral and other LLMs locally", https://ollama.ai/, 2024.
[8] Docker Inc., "Docker Documentation", https://docs.docker.com/, 2024.
[9] Redis Ltd., "Redis Documentation", https://redis.io/documentation, 2024.
[10] SQLAlchemy, "SQLAlchemy — The Database Toolkit for Python", https://www.sqlalchemy.org/, 2024.
[11] NIST, "Common Vulnerability Scoring System (CVSS)", https://nvd.nist.gov/vuln-metrics/cvss, 2024.
[12] Schwaber K., Sutherland J., "The Scrum Guide", https://scrumguides.org/, 2020.
[13] Jones C., "Software Engineering Best Practices", McGraw-Hill, 2010.
[14] Kim G. et al., "The DevOps Handbook", IT Revolution Press, 2016.
[15] Bass L. et al., "Software Architecture in Practice", 4th ed., Addison-Wesley, 2021.
```

---

## Instructions d'exécution pour GitHub Copilot

1. **Lire le rapport existant** (le texte du rapport fourni par l'utilisateur) et identifier chaque section correspondante.
2. **Pour chaque placeholder** (Figure X.Y – placeholder), générer le contenu textuel décrivant le diagramme UML correspondant **en respectant les noms de classes réels** du modèle SQLAlchemy (User, Role, Scan, Project, etc.).
3. **Pour chaque section manquante** identifiée ci-dessus, insérer le contenu complet en français académique, avec le même niveau de formalisme que le rapport de référence.
4. **Ne pas modifier** le contenu des sections déjà complètes et cohérentes (Introduction Générale, Chapitre 1, Section 2.3, Section 2.5).
5. **Vérifier la cohérence** des numéros de tableaux et figures après chaque ajout.
6. **Utiliser les vraies valeurs** : durées JWT 30 min, roles enum (admin/developer/security_manager/viewer), statuts vulnérabilités (open/in_progress/resolved/false_positive/risk_accepted), méthodes scan (cli/github/dast).
7. **Appliquer le style académique tunisien ISIMS** : phrases complètes, pas de bullet points dans le texte courant, formulation passive ("il convient de", "nous avons procédé à", "la solution proposée permet de").
