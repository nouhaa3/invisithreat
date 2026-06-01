# InvisiThreat — Plan de Sprints Agile & Diagrammes UML de Séquence

> **Langue** : Français (descriptions et objectifs) | Anglais (noms de classes, méthodes, paramètres)
> **Convention UML** : Pattern Boundary / Control / Entity (BCE)
> **Outil de diagrammes** : PlantUML

---

## Sprint 0 — Mise en place de l'environnement et architecture

### Objectif du Sprint
Initialiser l'infrastructure technique (Docker, CI/CD, base de données), prendre les décisions d'architecture, et produire les maquettes UI initiales.

### User Stories

| ID | User Story | Critères d'acceptation | Points |
|----|-----------|------------------------|--------|
| US-00-1 | En tant que **Tech Lead**, je veux que l'environnement Docker soit opérationnel afin que toute l'équipe puisse démarrer le projet localement. | - `docker-compose up` lance backend + frontend + DB sans erreur<br>- Variables d'env documentées dans `.env.example`<br>- Health check `/api/health` renvoie 200 | 5 |
| US-00-2 | En tant que **Tech Lead**, je veux définir l'architecture logicielle afin de guider les décisions techniques des prochains sprints. | - Document d'architecture validé<br>- Stack technique fixée (FastAPI, React, PostgreSQL)<br>- Diagramme de classes global produit | 3 |
| US-00-3 | En tant que **Designer**, je veux produire les maquettes UI principales afin que l'équipe frontend ait un référentiel visuel. | - Maquettes Login, Dashboard, Scan, Vulnerabilities produites<br>- Validées par le PO | 3 |
| US-00-4 | En tant que **DevOps**, je veux configurer le pipeline CI/CD afin d'automatiser les tests et le build. | - GitHub Actions exécute les tests à chaque push<br>- Build Docker validé | 5 |

**Total Sprint 0 : 16 points**

### Tâches techniques

**Backend**
- [ ] Initialiser le projet FastAPI avec structure modulaire (`api/`, `core/`, `models/`, `services/`)
- [ ] Configurer SQLAlchemy + Alembic + PostgreSQL
- [ ] Créer endpoint `/api/health`
- [ ] Configurer variables d'environnement (`ENCRYPTION_KEY`, `DATABASE_URL`, `JWT_SECRET`)

**Frontend**
- [ ] Initialiser projet React + Vite + Tailwind CSS
- [ ] Configurer routing (React Router)
- [ ] Créer composants de base (Button, InputField, AppLayout)

**Base de données**
- [ ] Créer migration initiale Alembic
- [ ] Définir modèles `User`, `Role`, `Project`, `Scan`, `Vulnerability`

**DevOps**
- [ ] Écrire `docker-compose.yml` (backend, frontend, db)
- [ ] Configurer GitHub Actions (lint + tests)
- [ ] Documenter setup dans `README.md`

**Tests**
- [ ] Configurer Pytest avec fixtures de base (`conftest.py`)
- [ ] Test sanity check `/api/health`

---

### Diagramme de séquence : UC-00-1 — Health Check & Démarrage application

**Acteur(s)** : DevOps Engineer

**Participants**

| Participant | Stéréotype | Rôle |
|------------|------------|------|
| `HealthCheckForm` | «boundary» | Interface de test (navigateur / curl) |
| `HealthController` | «control» | Contrôleur de santé système |
| `DatabaseEntity` | «entity» | Entité base de données |

```plantuml
@startuml UC-00-1_HealthCheck

skinparam participant {
    BackgroundColor<<boundary>> #DDEEFF
    BackgroundColor<<control>> #FFFACD
    BackgroundColor<<entity>> #DFFFDF
    BorderColor Black
}
skinparam sequenceArrowThickness 2
skinparam roundcorner 5
title UC-00-1 : Health Check & Démarrage Application

actor "DevOps Engineer" as DevOps
participant "HealthCheckForm\n«boundary»" as HCF <<boundary>>
participant "HealthController\n«control»" as HC <<control>>
participant "DatabaseEntity\n«entity»" as DB <<entity>>

activate DevOps

DevOps -> HCF : sendRequest(method: GET, path: "/api/health"): HttpRequest
activate HCF

HCF -> HC : handleHealthCheck(request: HttpRequest): HealthResponse
activate HC

HC -> DB : ping(): bool
activate DB

alt [DB accessible]
    DB --> HC : return true
    deactivate DB
    HC -> HC : buildHealthPayload(status: "ok", db: true): dict
    HC --> HCF : return HealthResponse(status=200, body={status:"ok"})
    HCF --> DevOps : display(response: HealthResponse)
else [DB inaccessible]
    DB --> HC : raise ConnectionError
    deactivate DB
    HC -> HC : buildErrorPayload(error: "db_unreachable"): dict
    HC --> HCF : return HealthResponse(status=503, body={status:"error"})
    HCF --> DevOps : display(errorMessage: "Service unavailable")
end

deactivate HC
deactivate HCF
deactivate DevOps

@enduml
```

**Explication du flux** :
Le DevOps envoie une requête GET via l'interface boundary `HealthCheckForm`. Le `HealthController` orchestre la vérification en interrogeant `DatabaseEntity`. En cas de succès, il retourne un payload `{status: "ok"}` avec HTTP 200. En cas d'échec de connexion DB, il retourne HTTP 503 avec un message d'erreur.

---

## Sprint 1 — Authentification & Contrôle d'accès par rôles (RBAC)

### Objectif du Sprint
Implémenter l'authentification sécurisée (inscription, connexion, JWT, vérification email) et le système RBAC avec 4 rôles (Admin, Developer, Security Manager, Viewer).

### User Stories

| ID | User Story | Critères d'acceptation | Points |
|----|-----------|------------------------|--------|
| US-01-1 | En tant qu'**Utilisateur**, je veux m'inscrire avec mon email et un mot de passe afin d'accéder à la plateforme. | - Formulaire avec validation (email unique, password ≥ 8 chars)<br>- Email de vérification envoyé<br>- Compte en statut "pending" jusqu'à vérification | 5 |
| US-01-2 | En tant qu'**Utilisateur**, je veux me connecter avec mes identifiants afin d'obtenir un token JWT valide. | - Login retourne `access_token` + `refresh_token`<br>- Token expire en 30min<br>- Refresh token en HttpOnly cookie<br>- Tentatives limitées (rate limiting) | 5 |
| US-01-3 | En tant qu'**Admin**, je veux assigner des rôles aux utilisateurs afin de contrôler leurs permissions. | - Admin peut modifier le rôle de tout utilisateur<br>- Action journalisée dans l'audit log<br>- Notification envoyée à l'utilisateur | 3 |
| US-01-4 | En tant qu'**Utilisateur**, je veux demander un changement de rôle afin d'obtenir des droits supplémentaires. | - Formulaire de demande de rôle disponible<br>- Admin reçoit notification de demande<br>- Utilisateur notifié de l'approbation/rejet | 3 |
| US-01-5 | En tant qu'**Utilisateur**, je veux réinitialiser mon mot de passe oublié afin de récupérer l'accès à mon compte. | - Envoi code par email<br>- Code expire après 15min<br>- Nouveau mot de passe enregistré avec bcrypt | 3 |
| US-01-6 | En tant qu'**Utilisateur**, je veux activer la double authentification (TOTP) afin de sécuriser mon compte. | - QR code généré pour configurateur TOTP<br>- Vérification TOTP à la connexion si activé<br>- Possibilité de désactiver le 2FA | 5 |

**Total Sprint 1 : 24 points**

### Tâches techniques

**Backend**
- [ ] Implémenter `POST /auth/register` — inscription avec hachage bcrypt
- [ ] Implémenter `POST /auth/login` — JWT + refresh token en cookie HttpOnly
- [ ] Implémenter `POST /auth/refresh` — rotation des refresh tokens
- [ ] Implémenter `POST /auth/logout` — révocation de session
- [ ] Implémenter `POST /auth/verify-email` — vérification par token
- [ ] Implémenter `POST /auth/forgot-password` + `POST /auth/reset-password`
- [ ] Implémenter `POST /auth/request-role` + endpoint Admin d'approbation
- [ ] Implémenter TOTP (`/auth/totp/setup`, `/auth/totp/verify`, `/auth/totp/disable`)
- [ ] Middleware RBAC `require_permission(P.xxx)`
- [ ] Service `audit_log` pour journaliser toutes les actions sensibles

**Frontend**
- [ ] Page `LoginPage.jsx` — formulaire de connexion
- [ ] Page `SignupPage.jsx` — formulaire d'inscription
- [ ] Page `ForgotPasswordPage.jsx` — réinitialisation
- [ ] Page `VerifyEmailPage.jsx` — vérification email
- [ ] `AuthContext` — gestion globale de l'état d'authentification
- [ ] Guards de route (`PrivateRoute`, vérification rôle)

**Base de données**
- [ ] Modèles `User`, `Role`, `AuthToken` (sessions), `AuditLog`
- [ ] Migration Alembic pour ces tables

**Tests**
- [ ] Tests unitaires service auth (register, login, JWT)
- [ ] Tests d'intégration endpoints auth
- [ ] Test RBAC — accès refusé si rôle insuffisant

---

### Diagramme de séquence : UC-01-1 — Inscription Utilisateur

**Acteur(s)** : Utilisateur non authentifié

```plantuml
@startuml UC-01-1_Register

skinparam participant {
    BackgroundColor<<boundary>> #DDEEFF
    BackgroundColor<<control>> #FFFACD
    BackgroundColor<<entity>> #DFFFDF
    BorderColor Black
}
skinparam sequenceArrowThickness 2
title UC-01-1 : Inscription d'un Utilisateur

actor "Utilisateur" as User
participant "SignupForm\n«boundary»" as SF <<boundary>>
participant "AuthController\n«control»" as AC <<control>>
participant "EmailService\n«control»" as ES <<control>>
participant "UserEntity\n«entity»" as UE <<entity>>

activate User
User -> SF : submitForm(email: str, password: str, fullName: str): FormData
activate SF

SF -> AC : register(userCreate: UserCreate): UserResponse
activate AC

AC -> AC : validateInput(email: str, password: str): bool

alt [email déjà enregistré]
    AC -> UE : findByEmail(email: str): User|None
    activate UE
    UE --> AC : return existingUser
    deactivate UE
    AC --> SF : raise HTTPException(status=409, detail="Email already registered")
    SF --> User : display(error: "Email déjà utilisé")

else [email disponible]
    AC -> AC : hashPassword(password: str): str
    AC -> UE : create(email: str, hashedPwd: str, status: "pending"): User
    activate UE
    UE --> AC : return newUser
    deactivate UE
    AC -> AC : generateVerificationToken(userId: int): str
    AC -> ES : sendVerificationEmail(email: str, token: str): None
    activate ES
    ES --> AC : return None
    deactivate ES
    AC --> SF : return UserResponse(id: int, status: "pending")
    SF --> User : display(message: "Vérifiez votre email")
end

deactivate AC
deactivate SF
deactivate User

@enduml
```

**Explication** : L'utilisateur soumet le formulaire via `SignupForm` (boundary). `AuthController` (control) valide l'unicité de l'email via `UserEntity`, hache le mot de passe avec bcrypt, persiste l'utilisateur en statut `pending`, génère un token de vérification et délègue l'envoi d'email à `EmailService`. Si l'email existe déjà, une erreur 409 est retournée.

---

### Diagramme de séquence : UC-01-2 — Connexion & Émission JWT

**Acteur(s)** : Utilisateur enregistré

```plantuml
@startuml UC-01-2_Login

skinparam participant {
    BackgroundColor<<boundary>> #DDEEFF
    BackgroundColor<<control>> #FFFACD
    BackgroundColor<<entity>> #DFFFDF
    BorderColor Black
}
skinparam sequenceArrowThickness 2
title UC-01-2 : Connexion et émission JWT

actor "Utilisateur" as User
participant "LoginForm\n«boundary»" as LF <<boundary>>
participant "AuthController\n«control»" as AC <<control>>
participant "SessionManager\n«control»" as SM <<control>>
participant "UserEntity\n«entity»" as UE <<entity>>
participant "AuthTokenEntity\n«entity»" as ATE <<entity>>

activate User
User -> LF : submitLogin(email: str, password: str): FormData
activate LF

LF -> AC : login(form: OAuth2PasswordRequestForm): LoginResponse
activate AC

AC -> UE : findByEmail(email: str): User|None
activate UE
UE --> AC : return user
deactivate UE

alt [utilisateur non trouvé ou mot de passe invalide]
    AC -> AC : verifyPassword(plain: str, hashed: str): bool
    AC --> LF : raise HTTPException(status=401, detail="Credentials invalides")
    LF --> User : display(error: "Identifiants incorrects")

else [compte non vérifié]
    AC --> LF : raise HTTPException(status=403, detail="Email non vérifié")
    LF --> User : display(error: "Vérifiez votre email")

else [authentification réussie]
    AC -> AC : createAccessToken(userId: int, role: str): str
    AC -> SM : createRefreshSession(userId: int): RefreshSession
    activate SM
    SM -> ATE : save(userId: int, tokenHash: str, expiresAt: datetime): AuthToken
    activate ATE
    ATE --> SM : return token
    deactivate ATE
    SM --> AC : return refreshToken: str
    deactivate SM

    opt [TOTP activé]
        AC -> AC : issueTotpChallenge(userId: int): TotpToken
        AC --> LF : return LoginResponse(totpRequired=true, tmpToken: str)
        LF --> User : display(totpForm: TotpChallengeForm)
    end

    AC --> LF : return LoginResponse(accessToken: str, tokenType: "bearer")
    LF --> User : storeToken(accessToken: str); redirect("/dashboard")
end

deactivate AC
deactivate LF
deactivate User

@enduml
```

**Explication** : Le `LoginForm` transmet les identifiants à `AuthController`. Après vérification du hash bcrypt via `UserEntity`, si l'authentification réussit, `SessionManager` crée une session refresh persistée dans `AuthTokenEntity`. En cas de TOTP activé, un challenge intermédiaire est émis. Les erreurs 401/403 sont retournées sans divulguer d'information sensible.

---

### Diagramme de séquence : UC-01-3 — Attribution de rôle par l'Admin

**Acteur(s)** : Admin

```plantuml
@startuml UC-01-3_AssignRole

skinparam participant {
    BackgroundColor<<boundary>> #DDEEFF
    BackgroundColor<<control>> #FFFACD
    BackgroundColor<<entity>> #DFFFDF
    BorderColor Black
}
skinparam sequenceArrowThickness 2
title UC-01-3 : Attribution de rôle par l'Admin

actor "Admin" as Admin
participant "AdminUserPanel\n«boundary»" as AUP <<boundary>>
participant "AuthController\n«control»" as AC <<control>>
participant "NotificationService\n«control»" as NS <<control>>
participant "AuditService\n«control»" as AS <<control>>
participant "UserEntity\n«entity»" as UE <<entity>>
participant "AuditLogEntity\n«entity»" as ALE <<entity>>

activate Admin
Admin -> AUP : submitRoleChange(targetUserId: int, newRole: str): FormData
activate AUP

AUP -> AC : updateUserRole(targetId: int, role: RoleUpdateRequest, currentUser: User): UserWithRole
activate AC

AC -> AC : require_admin(currentUser: User): None

alt [Admin tente de modifier le Primary Admin]
    AC --> AUP : raise HTTPException(status=403, detail="Action interdite")
    AUP --> Admin : display(error: "Impossible de modifier cet utilisateur")

else [modification autorisée]
    AC -> UE : findById(targetId: int): User
    activate UE
    UE --> AC : return targetUser
    deactivate UE
    AC -> UE : updateRole(user: User, newRole: str): User
    activate UE
    UE --> AC : return updatedUser
    deactivate UE
    AC -> AS : createAuditLog(action: "role_changed", actor: Admin, target: targetUser): None
    activate AS
    AS -> ALE : save(auditEntry: AuditLog): None
    activate ALE
    ALE --> AS : return None
    deactivate ALE
    deactivate AS
    AC -> NS : notifyRoleChanged(user: targetUser, newRole: str): None
    activate NS
    NS --> AC : return None
    deactivate NS
    AC --> AUP : return UserWithRole(id: int, role: str)
    AUP --> Admin : display(success: "Rôle mis à jour")
end

deactivate AC
deactivate AUP
deactivate Admin

@enduml
```

**Explication** : L'Admin soumet la modification via `AdminUserPanel` (boundary). `AuthController` vérifie d'abord que l'utilisateur courant est Admin et qu'il ne modifie pas le Primary Admin. La mise à jour est persistée dans `UserEntity`, puis journalisée via `AuditService` → `AuditLogEntity`, et une notification est envoyée à l'utilisateur concerné.

---

## Sprint 2 — Gestion des projets & Intégration GitHub

### Objectif du Sprint
Permettre aux développeurs de créer et gérer des projets, de connecter des dépôts GitHub via OAuth ou clé d'accès, et de gérer les membres d'un projet.

### User Stories

| ID | User Story | Critères d'acceptation | Points |
|----|-----------|------------------------|--------|
| US-02-1 | En tant que **Developer**, je veux créer un projet afin d'organiser mes scans de sécurité. | - Formulaire avec nom, description, type (SAST/DAST)<br>- Projet associé à l'utilisateur créateur<br>- Visible dans la liste des projets | 3 |
| US-02-2 | En tant que **Developer**, je veux connecter un dépôt GitHub à mon projet afin de lancer des scans sur mon code. | - Connexion via OAuth GitHub ou Personal Access Token (chiffré)<br>- Dépôt validé (accès vérifié)<br>- Branche par défaut configurable | 5 |
| US-02-3 | En tant qu'**Admin / Developer (owner)**, je veux gérer les membres d'un projet afin de contrôler qui peut lancer des scans. | - Ajout/retrait de membres<br>- Attribution d'un rôle dans le projet (owner, member)<br>- Journalisation des changements | 3 |
| US-02-4 | En tant que **Developer**, je veux consulter la liste de mes projets afin d'accéder rapidement à leurs statuts. | - Liste paginée avec statut, dernier scan, score de risque<br>- Filtres par statut et type | 2 |
| US-02-5 | En tant qu'**Admin**, je veux superviser tous les projets de la plateforme afin d'assurer la gouvernance. | - Vue admin avec tous les projets<br>- Possibilité d'archiver/supprimer un projet<br>- Statistiques globales | 3 |

**Total Sprint 2 : 16 points**

### Tâches techniques

**Backend**
- [ ] `POST /projects` — création de projet
- [ ] `GET /projects` — liste des projets de l'utilisateur
- [ ] `PUT /projects/{id}` — mise à jour
- [ ] `DELETE /projects/{id}` — suppression (Admin)
- [ ] `POST /projects/{id}/github` — connexion dépôt GitHub (token chiffré)
- [ ] `GET /projects/{id}/members` + `POST /projects/{id}/members` + `DELETE`
- [ ] `GET /admin/projects` — vue admin globale
- [ ] Service `encrypt_token` pour chiffrement AES-256 des PAT GitHub

**Frontend**
- [ ] Page `ProjectsPage.jsx` — liste des projets
- [ ] Page `EditProjectPage.jsx` — création/édition
- [ ] Page `ProjectMembersPage.jsx` — gestion des membres
- [ ] Composant `ProjectDetail.jsx` — vue détaillée d'un projet
- [ ] Intégration OAuth GitHub (callback page)

**Base de données**
- [ ] Modèles `Project`, `ProjectMember`, `GitHubRepository`
- [ ] Migration Alembic

**Tests**
- [ ] Tests CRUD projets
- [ ] Test isolation : un Developer ne voit que ses propres projets
- [ ] Test chiffrement token GitHub

---

### Diagramme de séquence : UC-02-1 — Création d'un Projet

**Acteur(s)** : Developer

```plantuml
@startuml UC-02-1_CreateProject

skinparam participant {
    BackgroundColor<<boundary>> #DDEEFF
    BackgroundColor<<control>> #FFFACD
    BackgroundColor<<entity>> #DFFFDF
    BorderColor Black
}
skinparam sequenceArrowThickness 2
title UC-02-1 : Création d'un projet

actor "Developer" as Dev
participant "ProjectForm\n«boundary»" as PF <<boundary>>
participant "ProjectController\n«control»" as PC <<control>>
participant "AuditService\n«control»" as AS <<control>>
participant "ProjectEntity\n«entity»" as PE <<entity>>
participant "MemberEntity\n«entity»" as ME <<entity>>

activate Dev
Dev -> PF : submitProject(name: str, description: str, type: str): FormData
activate PF

PF -> PC : createProject(projectCreate: ProjectCreate, currentUser: User): ProjectResponse
activate PC

PC -> PC : validateName(name: str): bool

alt [nom vide ou trop long]
    PC --> PF : raise HTTPException(status=422, detail="Nom invalide")
    PF --> Dev : display(validationError: str)

else [projet valide]
    PC -> PE : save(project: Project): Project
    activate PE
    PE --> PC : return savedProject
    deactivate PE
    PC -> ME : addOwner(projectId: int, userId: int, role: "owner"): ProjectMember
    activate ME
    ME --> PC : return member
    deactivate ME
    PC -> AS : log(action: "project_created", userId: int, projectId: int): None
    activate AS
    AS --> PC : return None
    deactivate AS
    PC --> PF : return ProjectResponse(id: int, name: str, status: "active")
    PF --> Dev : redirect("/projects/{id}")
end

deactivate PC
deactivate PF
deactivate Dev

@enduml
```

**Explication** : Le `Developer` soumet le formulaire de création via `ProjectForm` (boundary). `ProjectController` valide le nom, persiste le projet dans `ProjectEntity`, ajoute automatiquement le créateur comme owner dans `MemberEntity`, et journalise l'action. En cas de validation échouée, une erreur 422 est retournée.

---

### Diagramme de séquence : UC-02-2 — Connexion d'un Dépôt GitHub

**Acteur(s)** : Developer

```plantuml
@startuml UC-02-2_ConnectGitHub

skinparam participant {
    BackgroundColor<<boundary>> #DDEEFF
    BackgroundColor<<control>> #FFFACD
    BackgroundColor<<entity>> #DFFFDF
    BorderColor Black
}
skinparam sequenceArrowThickness 2
title UC-02-2 : Connexion d'un dépôt GitHub

actor "Developer" as Dev
participant "GitHubIntegrationForm\n«boundary»" as GIF <<boundary>>
participant "IntegrationController\n«control»" as IC <<control>>
participant "EncryptionService\n«control»" as ENC <<control>>
participant "GitHubAPIAdapter\n«control»" as GH <<control>>
participant "GitHubRepoEntity\n«entity»" as GRE <<entity>>

activate Dev
Dev -> GIF : submitToken(projectId: int, token: str, repoUrl: str): FormData
activate GIF

GIF -> IC : connectRepository(projectId: int, token: str, repoUrl: str): RepoResponse
activate IC

IC -> GH : validateAccess(token: str, repoUrl: str): bool
activate GH

alt [token invalide ou accès refusé]
    GH --> IC : raise GitHubAuthError
    deactivate GH
    IC --> GIF : raise HTTPException(status=401, detail="Token GitHub invalide")
    GIF --> Dev : display(error: "Accès GitHub refusé")

else [accès validé]
    GH --> IC : return repoMetadata: dict
    deactivate GH
    IC -> ENC : encrypt(plainToken: str): str
    activate ENC
    ENC --> IC : return encryptedToken: str
    deactivate ENC
    IC -> GRE : save(projectId: int, encryptedToken: str, repoUrl: str): GitHubRepository
    activate GRE
    GRE --> IC : return savedRepo
    deactivate GRE
    IC --> GIF : return RepoResponse(id: int, repoUrl: str, connected: true)
    GIF --> Dev : display(success: "Dépôt connecté")
end

deactivate IC
deactivate GIF
deactivate Dev

@enduml
```

**Explication** : Le `Developer` soumet son Personal Access Token GitHub via `GitHubIntegrationForm`. `IntegrationController` valide l'accès auprès de l'API GitHub (`GitHubAPIAdapter`). Si l'accès est confirmé, `EncryptionService` chiffre le token (AES-256/Fernet) avant de le persister dans `GitHubRepoEntity`. Le token en clair n'est jamais stocké.

---

## Sprint 3 — Scan SAST (Static Application Security Testing)

### Objectif du Sprint
Implémenter le lancement, le suivi en temps réel et l'affichage des résultats de scans SAST via l'interface web et le CLI, avec normalisation des vulnérabilités détectées.

### User Stories

| ID | User Story | Critères d'acceptation | Points |
|----|-----------|------------------------|--------|
| US-03-1 | En tant que **Developer**, je veux lancer un scan SAST sur mon dépôt GitHub afin de détecter les vulnérabilités dans mon code. | - Bouton "New Scan" déclenche le scan<br>- Scan exécuté en tâche asynchrone (Celery)<br>- Statuts : pending → running → completed/failed | 8 |
| US-03-2 | En tant que **Developer**, je veux suivre la progression d'un scan en temps réel afin de savoir quand les résultats sont disponibles. | - WebSocket / Socket.IO envoie les mises à jour de statut<br>- Barre de progression visible dans l'UI<br>- Notification à la fin du scan | 5 |
| US-03-3 | En tant que **Developer**, je veux consulter les vulnérabilités détectées afin de les corriger. | - Liste des vulnérabilités avec : titre, sévérité, fichier, ligne<br>- Filtres par sévérité (critical, high, medium, low)<br>- Lien vers le fichier dans GitHub | 5 |
| US-03-4 | En tant que **Developer**, je veux lancer un scan via le CLI afin d'intégrer InvisiThreat dans mon workflow local. | - `invisithreat scan --project <id> --type sast` fonctionne<br>- Résultats uploadés via API<br>- Token CLI généré dans les settings | 5 |

**Total Sprint 3 : 23 points**

### Tâches techniques

**Backend**
- [ ] `POST /projects/{id}/scans` — déclenchement scan SAST
- [ ] Worker Celery `run_github_scan_job` — clone repo, exécute outils SAST
- [ ] Service `github_scanner` — normalisation résultats (Bandit, Semgrep)
- [ ] `GET /projects/{id}/scans` — historique des scans
- [ ] `GET /projects/{id}/scans/{scanId}` — détail d'un scan
- [ ] Socket.IO events : `scan_status_update`, `scan_completed`
- [ ] `POST /projects/{id}/cli-token` — génération token CLI
- [ ] `POST /cli/scan/upload` — upload résultats CLI

**Frontend**
- [ ] Page `NewScanPage.jsx` — wizard de lancement
- [ ] Composant de suivi temps réel (Socket.IO hook)
- [ ] Vue vulnérabilités dans `ProjectDetail.jsx`
- [ ] Filtres et tri des vulnérabilités

**Base de données**
- [ ] Modèles `Scan`, `Vulnerability`, `ScanSummary`, `ToolExecution`
- [ ] Migration Alembic

**Tests**
- [ ] Test lancement et fin de scan (mock GitHub)
- [ ] Test normalisation des résultats
- [ ] Test upload CLI

---

### Diagramme de séquence : UC-03-1 — Lancement d'un Scan SAST

**Acteur(s)** : Developer

```plantuml
@startuml UC-03-1_LaunchSAST

skinparam participant {
    BackgroundColor<<boundary>> #DDEEFF
    BackgroundColor<<control>> #FFFACD
    BackgroundColor<<entity>> #DFFFDF
    BorderColor Black
}
skinparam sequenceArrowThickness 2
title UC-03-1 : Lancement d'un Scan SAST

actor "Developer" as Dev
participant "NewScanForm\n«boundary»" as NSF <<boundary>>
participant "ScanController\n«control»" as SC <<control>>
participant "ScanWorker\n«control»" as SW <<control>>
participant "NotificationService\n«control»" as NS <<control>>
participant "ScanEntity\n«entity»" as SE <<entity>>
participant "VulnerabilityEntity\n«entity»" as VE <<entity>>

activate Dev
Dev -> NSF : submitScan(projectId: int, type: "sast", branch: str): FormData
activate NSF

NSF -> SC : createScan(projectId: int, scanCreate: ScanCreate, user: User): ScanResponse
activate SC

SC -> SC : checkPermission(user: User, projectId: int): None

alt [permission refusée]
    SC --> NSF : raise HTTPException(status=403, detail="Accès refusé")
    NSF --> Dev : display(error: "Vous n'avez pas accès à ce projet")

else [permission accordée]
    SC -> SE : save(scan: Scan{status: "pending"}): Scan
    activate SE
    SE --> SC : return pendingScan
    deactivate SE
    SC -> SW : enqueue(runGithubScanJob, scanId: int): AsyncResult
    activate SW
    SW -> SW : cloneRepository(repoUrl: str, token: str): Path
    SW -> SW : runSASTTools(path: Path): List[Finding]
    SW -> SW : normalizeFindings(findings: List): List[Vulnerability]
    loop [pour chaque vulnérabilité normalisée]
        SW -> VE : save(vuln: Vulnerability): Vulnerability
        activate VE
        VE --> SW : return savedVuln
        deactivate VE
    end
    SW -> SE : updateStatus(scanId: int, status: "completed"): Scan
    activate SE
    SE --> SW : return updatedScan
    deactivate SE
    SW -> NS : notifyScanCompleted(userId: int, scanId: int): None
    activate NS
    NS --> SW : return None
    deactivate NS
    deactivate SW
    SC --> NSF : return ScanResponse(id: int, status: "pending")
    NSF --> Dev : display(message: "Scan lancé"); redirect("/project/{id}")
end

deactivate SC
deactivate NSF
deactivate Dev

@enduml
```

**Explication** : Le `Developer` déclenche un scan SAST via `NewScanForm`. `ScanController` vérifie les permissions, crée un `Scan` en statut `pending` dans `ScanEntity`, puis enfile la tâche dans `ScanWorker` (Celery). Le worker clone le dépôt, exécute les outils SAST, normalise les résultats, persiste chaque `Vulnerability` et met à jour le statut du scan à `completed`. Une notification est envoyée en fin de traitement.

---

### Diagramme de séquence : UC-03-2 — Suivi Temps Réel via Socket.IO

**Acteur(s)** : Developer

```plantuml
@startuml UC-03-2_RealtimeTracking

skinparam participant {
    BackgroundColor<<boundary>> #DDEEFF
    BackgroundColor<<control>> #FFFACD
    BackgroundColor<<entity>> #DFFFDF
    BorderColor Black
}
skinparam sequenceArrowThickness 2
title UC-03-2 : Suivi temps réel d'un scan via Socket.IO

actor "Developer" as Dev
participant "ScanProgressUI\n«boundary»" as SPUI <<boundary>>
participant "SocketIOGateway\n«boundary»" as SIO <<boundary>>
participant "ScanController\n«control»" as SC <<control>>
participant "ScanWorker\n«control»" as SW <<control>>
participant "ScanEntity\n«entity»" as SE <<entity>>

activate Dev
Dev -> SPUI : openScanDetail(scanId: int): void
activate SPUI

SPUI -> SIO : connect(namespace: "/scans", token: JWT): void
activate SIO
SIO --> SPUI : emit("connected"): void

Dev -> SPUI : subscribeScanRoom(scanId: int): void
SPUI -> SIO : emit("join_room", {scanId: int}): void

note over SW : Pendant l'exécution du scan...

loop [à chaque étape du scan]
    SW -> SC : reportProgress(scanId: int, step: str, progress: int): void
    activate SC
    SC -> SE : updateProgress(scanId: int, progress: int): void
    activate SE
    SE --> SC : return None
    deactivate SE
    SC -> SIO : broadcast("scan_progress", {scanId, step, progress}): void
    deactivate SC
    SIO --> SPUI : receive("scan_progress", payload: dict): void
    SPUI --> Dev : update(progressBar: int, statusLabel: str)
end

SW -> SIO : broadcast("scan_completed", {scanId, vulnCount: int}): void
SIO --> SPUI : receive("scan_completed", payload: dict): void
SPUI --> Dev : display(notification: "Scan terminé — N vulnérabilités")
SPUI -> SIO : disconnect(): void
deactivate SIO
deactivate SPUI
deactivate Dev

@enduml
```

**Explication** : `ScanProgressUI` (boundary) établit une connexion Socket.IO via `SocketIOGateway` (boundary réseau). À chaque étape du scan, `ScanWorker` notifie `ScanController`, qui met à jour `ScanEntity` et diffuse un événement via le gateway. L'UI reçoit les mises à jour en temps réel et affiche la progression. À la fin, un événement `scan_completed` déclenche une notification visuelle.

---

## Sprint 4 — Scan DAST (Dynamic Application Security Testing)

### Objectif du Sprint
Implémenter le scan DAST via une sonde HTTP interne et/ou OWASP ZAP, permettre le lancement sur une URL cible, le suivi, et la consultation des résultats.

### User Stories

| ID | User Story | Critères d'acceptation | Points |
|----|-----------|------------------------|--------|
| US-04-1 | En tant que **Developer**, je veux lancer un scan DAST sur une URL cible afin de détecter les vulnérabilités applicatives à l'exécution. | - URL validée (format, accessibilité)<br>- Scan asynchrone (Celery)<br>- Résultats normalisés avec sévérité | 8 |
| US-04-2 | En tant que **Security Manager**, je veux comparer deux scans DAST afin de suivre l'évolution des vulnérabilités. | - Vue comparaison : vulnérabilités nouvelles, résolues, persistantes<br>- Score de risque différentiel affiché | 5 |
| US-04-3 | En tant que **Developer**, je veux voir les alertes DAST avec leurs recommandations afin de prioriser les corrections. | - Chaque alerte inclut : CWEID, description, URL affectée, sévérité<br>- Recommandation LLM disponible | 3 |

**Total Sprint 4 : 16 points**

### Tâches techniques

**Backend**
- [ ] `POST /projects/{id}/scans` avec `type: "dast"` et `target_url`
- [ ] Worker DAST : sonde HTTP minimaliste (probe + ZAP si disponible)
- [ ] Normalisation des alertes ZAP vers modèle `Vulnerability`
- [ ] `GET /projects/{id}/scans/compare?scan1=X&scan2=Y` — comparaison
- [ ] Service `risk_score` — calcul du score de risque post-scan

**Frontend**
- [ ] Wizard `NewScanPage.jsx` — step URL target pour DAST
- [ ] Composant comparaison de scans
- [ ] Affichage score de risque

**Base de données**
- [ ] Modèles `ScanComparison`, `RiskScore`
- [ ] Migration Alembic

**Tests**
- [ ] Test launch DAST avec URL valide/invalide
- [ ] Test normalisation alertes ZAP
- [ ] Test calcul score de risque

---

### Diagramme de séquence : UC-04-1 — Lancement d'un Scan DAST

**Acteur(s)** : Developer

```plantuml
@startuml UC-04-1_LaunchDAST

skinparam participant {
    BackgroundColor<<boundary>> #DDEEFF
    BackgroundColor<<control>> #FFFACD
    BackgroundColor<<entity>> #DFFFDF
    BorderColor Black
}
skinparam sequenceArrowThickness 2
title UC-04-1 : Lancement d'un Scan DAST

actor "Developer" as Dev
participant "DASTScanForm\n«boundary»" as DSF <<boundary>>
participant "ScanController\n«control»" as SC <<control>>
participant "DASTWorker\n«control»" as DW <<control>>
participant "RiskScoreService\n«control»" as RSS <<control>>
participant "ScanEntity\n«entity»" as SE <<entity>>
participant "VulnerabilityEntity\n«entity»" as VE <<entity>>
participant "RiskScoreEntity\n«entity»" as RSE <<entity>>

activate Dev
Dev -> DSF : submitDAST(projectId: int, targetUrl: str): FormData
activate DSF

DSF -> SC : createScan(projectId: int, type: "dast", targetUrl: str): ScanResponse
activate SC

SC -> SC : validateUrl(targetUrl: str): bool

alt [URL invalide ou inaccessible]
    SC --> DSF : raise HTTPException(status=422, detail="URL cible invalide")
    DSF --> Dev : display(error: "URL invalide")

else [URL valide]
    SC -> SE : save(scan: Scan{type:"dast", status:"pending"}): Scan
    activate SE
    SE --> SC : return pendingScan
    deactivate SE
    SC -> DW : enqueue(runDastScanJob, scanId: int, url: str): AsyncResult
    activate DW
    DW -> DW : probeTarget(url: str): ProbeResult
    DW -> DW : runZAPScan(url: str): List[Alert]
    alt [ZAP disponible]
        DW -> DW : normalizeZAPAlerts(alerts: List[Alert]): List[Vulnerability]
    else [ZAP non disponible]
        DW -> DW : runMinimalProbe(url: str): List[Vulnerability]
    end
    loop [pour chaque alerte normalisée]
        DW -> VE : save(vuln: Vulnerability): Vulnerability
        activate VE
        VE --> DW : return savedVuln
        deactivate VE
    end
    DW -> SE : updateStatus(scanId: int, status: "completed"): Scan
    activate SE
    SE --> DW : return updatedScan
    deactivate SE
    DW -> RSS : compute(scanId: int): RiskScore
    activate RSS
    RSS -> RSE : save(riskScore: RiskScore): RiskScore
    activate RSE
    RSE --> RSS : return savedScore
    deactivate RSE
    RSS --> DW : return riskScore
    deactivate RSS
    deactivate DW
    SC --> DSF : return ScanResponse(id: int, status: "pending")
    DSF --> Dev : display(message: "Scan DAST lancé")
end

deactivate SC
deactivate DSF
deactivate Dev

@enduml
```

**Explication** : Après validation de l'URL cible, `ScanController` crée le scan et délègue au `DASTWorker`. Si OWASP ZAP est disponible, il l'utilise pour le scan complet, sinon il exécute une sonde HTTP minimale. Les alertes normalisées sont persistées dans `VulnerabilityEntity`. Après le scan, `RiskScoreService` calcule et persiste le score de risque.

---

## Sprint 5 — Workflow de gestion des vulnérabilités

### Objectif du Sprint
Implémenter le workflow collaboratif de traitement des vulnérabilités : assignation, changement de statut, commentaires, et notifications aux parties prenantes.

### User Stories

| ID | User Story | Critères d'acceptation | Points |
|----|-----------|------------------------|--------|
| US-05-1 | En tant que **Security Manager**, je veux assigner une vulnérabilité à un développeur afin qu'il la corrige. | - Vulnérabilité assignée à un membre du projet<br>- Développeur notifié<br>- Statut passe à `in_progress` | 3 |
| US-05-2 | En tant que **Developer**, je veux mettre à jour le statut d'une vulnérabilité afin de refléter mon avancement. | - Statuts : `open`, `in_progress`, `resolved`, `false_positive`<br>- Changement journalisé<br>- Security Manager notifié à la résolution | 3 |
| US-05-3 | En tant que **Developer / Security Manager**, je veux commenter une vulnérabilité afin de collaborer sur sa résolution. | - Commentaires avec horodatage et auteur<br>- Liste des commentaires visible dans la vue détail | 2 |
| US-05-4 | En tant que **Developer**, je veux marquer une vulnérabilité comme faux positif afin d'éviter le bruit dans les rapports. | - Statut `false_positive` disponible<br>- Justification requise<br>- Security Manager notifié pour validation | 3 |
| US-05-5 | En tant qu'**Admin/Security Manager**, je veux valider un projet afin de confirmer que les vulnérabilités critiques sont résolues. | - Bouton "Validate Project" disponible<br>- Vérification automatique : 0 vulnérabilité critique ouverte<br>- Projet marqué "validated" | 5 |

**Total Sprint 5 : 16 points**

### Tâches techniques

**Backend**
- [ ] `GET /projects/{id}/security/vulnerability-tasks` — liste des tâches
- [ ] `PATCH /projects/{id}/security/vulnerability-tasks/{taskId}` — mise à jour statut/assigné
- [ ] `POST /projects/{id}/security/vulnerability-tasks/{taskId}/comments` — ajout commentaire
- [ ] Service `sync_vulnerability_tasks_for_scan` — synchronisation findings → tâches
- [ ] Notifications : Security Manager → Developer (assignation), Developer → Sec Manager (résolution)
- [ ] Validation projet : vérification vulnérabilités critiques ouvertes

**Frontend**
- [ ] Vue workflow dans `ProjectDetail.jsx`
- [ ] Modal assignation + changement statut
- [ ] Section commentaires par vulnérabilité
- [ ] Boutons "Trigger Re-scan" et "Validate Project"

**Base de données**
- [ ] Modèles `VulnerabilityTask`, `VulnerabilityTaskComment`
- [ ] Migration Alembic (revision 20260415_0003)

**Tests**
- [ ] Test cycle complet : open → in_progress → resolved
- [ ] Test notification Security Manager
- [ ] Test faux positif avec justification

---

### Diagramme de séquence : UC-05-1 — Assignation d'une Vulnérabilité

**Acteur(s)** : Security Manager

```plantuml
@startuml UC-05-1_AssignVuln

skinparam participant {
    BackgroundColor<<boundary>> #DDEEFF
    BackgroundColor<<control>> #FFFACD
    BackgroundColor<<entity>> #DFFFDF
    BorderColor Black
}
skinparam sequenceArrowThickness 2
title UC-05-1 : Assignation d'une vulnérabilité

actor "Security Manager" as SM
participant "VulnerabilityPanel\n«boundary»" as VP <<boundary>>
participant "VulnWorkflowController\n«control»" as VWC <<control>>
participant "NotificationService\n«control»" as NS <<control>>
participant "VulnTaskEntity\n«entity»" as VTE <<entity>>

activate SM
SM -> VP : assignVuln(taskId: int, assigneeId: int): FormAction
activate VP

VP -> VWC : updateTask(taskId: int, update: VulnerabilityTaskUpdateRequest): VulnerabilityTaskResponse
activate VWC

VWC -> VWC : checkPermission(currentUser: User, projectId: int): None

alt [permission insuffisante]
    VWC --> VP : raise HTTPException(status=403, detail="Réservé au Security Manager")
    VP --> SM : display(error: "Permission refusée")

else [permission accordée]
    VWC -> VTE : findById(taskId: int): VulnerabilityTask
    activate VTE
    VTE --> VWC : return task
    deactivate VTE
    VWC -> VTE : update(task: VulnerabilityTask, assigneeId: int, status: "in_progress"): VulnerabilityTask
    activate VTE
    VTE --> VWC : return updatedTask
    deactivate VTE
    VWC -> NS : notifyAssignment(assigneeId: int, taskId: int, projectId: int): None
    activate NS
    NS --> VWC : return None
    deactivate NS
    VWC --> VP : return VulnerabilityTaskResponse(id: int, status: "in_progress", assignee: str)
    VP --> SM : display(success: "Vulnérabilité assignée")
end

deactivate VWC
deactivate VP
deactivate SM

@enduml
```

**Explication** : Le `Security Manager` sélectionne une vulnérabilité et désigne un développeur dans `VulnerabilityPanel`. `VulnWorkflowController` vérifie les droits, récupère la tâche via `VulnTaskEntity`, la met à jour (statut `in_progress`, assigné), puis notifie le développeur via `NotificationService`.

---

### Diagramme de séquence : UC-05-2 — Changement de Statut d'une Vulnérabilité

**Acteur(s)** : Developer

```plantuml
@startuml UC-05-2_UpdateVulnStatus

skinparam participant {
    BackgroundColor<<boundary>> #DDEEFF
    BackgroundColor<<control>> #FFFACD
    BackgroundColor<<entity>> #DFFFDF
    BorderColor Black
}
skinparam sequenceArrowThickness 2
title UC-05-2 : Mise à jour du statut d'une vulnérabilité

actor "Developer" as Dev
participant "VulnerabilityPanel\n«boundary»" as VP <<boundary>>
participant "VulnWorkflowController\n«control»" as VWC <<control>>
participant "NotificationService\n«control»" as NS <<control>>
participant "VulnTaskEntity\n«entity»" as VTE <<entity>>

activate Dev
Dev -> VP : changeStatus(taskId: int, newStatus: str, comment: str): FormAction
activate VP

VP -> VWC : updateTask(taskId: int, update: VulnerabilityTaskUpdateRequest): VulnerabilityTaskResponse
activate VWC

VWC -> VTE : findById(taskId: int): VulnerabilityTask
activate VTE
VTE --> VWC : return task
deactivate VTE

alt [statut "false_positive" sans justification]
    VWC --> VP : raise HTTPException(status=422, detail="Justification requise")
    VP --> Dev : display(error: "Veuillez fournir une justification")

else [statut valide]
    VWC -> VTE : update(task, status: newStatus): VulnerabilityTask
    activate VTE
    VTE --> VWC : return updatedTask
    deactivate VTE
    opt [statut == "resolved" ou "false_positive"]
        VWC -> NS : notifySecurityManager(projectId: int, taskId: int, status: str): None
        activate NS
        NS --> VWC : return None
        deactivate NS
    end
    VWC --> VP : return VulnerabilityTaskResponse(id: int, status: str)
    VP --> Dev : display(success: "Statut mis à jour")
end

deactivate VWC
deactivate VP
deactivate Dev

@enduml
```

**Explication** : Le `Developer` change le statut d'une tâche via `VulnerabilityPanel`. Si le statut est `false_positive` sans justification, une erreur 422 est retournée. Pour les transitions `resolved` ou `false_positive`, `NotificationService` notifie le Security Manager afin qu'il puisse valider la décision.

---

## Sprint 6 — Dashboard, Rapports & Recommandations LLM

### Objectif du Sprint
Offrir des tableaux de bord adaptés par rôle (Admin, Developer, Security Manager), un système de score de risque, des recommandations LLM pour chaque vulnérabilité, et l'export de rapports.

### User Stories

| ID | User Story | Critères d'acceptation | Points |
|----|-----------|------------------------|--------|
| US-06-1 | En tant que **Developer**, je veux voir mon tableau de bord personnalisé afin d'avoir une vue d'ensemble de mes projets et vulnérabilités. | - Statistiques : projets actifs, scans récents, vulnérabilités ouvertes<br>- Graphiques d'évolution par sévérité | 5 |
| US-06-2 | En tant que **Security Manager**, je veux voir le tableau de bord sécurité global afin de piloter la posture de sécurité. | - Vue cross-projets : scores de risque, top vulnérabilités<br>- Projets par statut de validation | 5 |
| US-06-3 | En tant qu'**Admin**, je veux voir le tableau de bord administrateur afin de superviser l'utilisation de la plateforme. | - Stats utilisateurs actifs, scans lancés, projets créés<br>- Actions rapides (suspendre, archiver) | 3 |
| US-06-4 | En tant que **Developer / Security Manager**, je veux obtenir des recommandations LLM pour une vulnérabilité afin d'accélérer la correction. | - Bouton "Get AI Recommendation" disponible<br>- Recommandation inclut : explication, code fix example, références CWE/OWASP | 5 |
| US-06-5 | En tant que **Security Manager**, je veux exporter un rapport de scan afin de le partager avec les parties prenantes. | - Export JSON disponible<br>- Rapport inclut : résumé, liste vulnérabilités, score de risque<br>- Export PDF si disponible | 3 |

**Total Sprint 6 : 21 points**

### Tâches techniques

**Backend**
- [ ] `GET /dashboard` — statistiques personnalisées par rôle
- [ ] `GET /admin/dashboard` — statistiques admin
- [ ] `GET /security/dashboard` — vue Security Manager
- [ ] `POST /projects/{id}/llm/recommend` — recommandation LLM par vulnérabilité
- [ ] `GET /projects/{id}/scans/{scanId}/report` — export rapport JSON
- [ ] Service `risk_score` — calcul et historique
- [ ] Service `llm` — intégration LLM (OpenAI / local)

**Frontend**
- [ ] Page `Dashboard.jsx` — vue adaptative par rôle
- [ ] Composants graphiques (Charts) : sévérités, évolution
- [ ] Page `Summaries.jsx` — résumés de scans
- [ ] Modal `SummaryModal.jsx` — détail d'un résumé
- [ ] Bouton export rapport

**Tests**
- [ ] Test dashboard Developer vs Security Manager vs Admin (RBAC)
- [ ] Test recommandation LLM (mock LLM)
- [ ] Test export rapport

---

### Diagramme de séquence : UC-06-1 — Tableau de Bord Developer

**Acteur(s)** : Developer

```plantuml
@startuml UC-06-1_DeveloperDashboard

skinparam participant {
    BackgroundColor<<boundary>> #DDEEFF
    BackgroundColor<<control>> #FFFACD
    BackgroundColor<<entity>> #DFFFDF
    BorderColor Black
}
skinparam sequenceArrowThickness 2
title UC-06-1 : Affichage du tableau de bord Developer

actor "Developer" as Dev
participant "DashboardPage\n«boundary»" as DP <<boundary>>
participant "DashboardController\n«control»" as DC <<control>>
participant "ProjectEntity\n«entity»" as PE <<entity>>
participant "ScanEntity\n«entity»" as SE <<entity>>
participant "VulnerabilityEntity\n«entity»" as VE <<entity>>

activate Dev
Dev -> DP : navigate(path: "/dashboard"): void
activate DP

DP -> DC : getDashboard(currentUser: User): DashboardResponse
activate DC

DC -> PE : findByUserId(userId: int): List[Project]
activate PE
PE --> DC : return projects: List[Project]
deactivate PE

DC -> SE : getRecentScans(projectIds: List[int], limit: 5): List[Scan]
activate SE
SE --> DC : return recentScans
deactivate SE

DC -> VE : countOpenVulns(projectIds: List[int], bySeverity: bool): dict
activate VE
VE --> DC : return vulnStats: {critical: int, high: int, medium: int, low: int}
deactivate VE

DC -> DC : buildDashboardPayload(projects, scans, vulnStats): DashboardResponse
DC --> DP : return DashboardResponse(projectCount, vulnStats, recentScans)
DP --> Dev : render(dashboard: DashboardView)

deactivate DC
deactivate DP
deactivate Dev

@enduml
```

**Explication** : Le `Developer` accède au dashboard via `DashboardPage`. `DashboardController` récupère séquentiellement les projets (`ProjectEntity`), les scans récents (`ScanEntity`) et les statistiques de vulnérabilités (`VulnerabilityEntity`), agrège les données, et retourne un payload complet rendu par l'UI. La séparation des entités reflète la stricte isolation des responsabilités.

---

### Diagramme de séquence : UC-06-4 — Recommandation LLM pour une Vulnérabilité

**Acteur(s)** : Developer

```plantuml
@startuml UC-06-4_LLMRecommendation

skinparam participant {
    BackgroundColor<<boundary>> #DDEEFF
    BackgroundColor<<control>> #FFFACD
    BackgroundColor<<entity>> #DFFFDF
    BorderColor Black
}
skinparam sequenceArrowThickness 2
title UC-06-4 : Recommandation LLM pour une vulnérabilité

actor "Developer" as Dev
participant "VulnerabilityDetailPanel\n«boundary»" as VDP <<boundary>>
participant "LLMController\n«control»" as LLMC <<control>>
participant "LLMAdapter\n«control»" as LA <<control>>
participant "VulnerabilityEntity\n«entity»" as VE <<entity>>
participant "RecommendationEntity\n«entity»" as RE <<entity>>

activate Dev
Dev -> VDP : requestRecommendation(vulnId: int): void
activate VDP

VDP -> LLMC : getRecommendation(vulnId: int, projectId: int): RecommendationResponse
activate LLMC

LLMC -> VE : findById(vulnId: int): Vulnerability
activate VE
VE --> LLMC : return vulnerability
deactivate VE

LLMC -> RE : findCached(vulnId: int): Recommendation|None
activate RE
RE --> LLMC : return cachedRec|None
deactivate RE

alt [recommandation en cache]
    LLMC --> VDP : return cachedRecommendation
    VDP --> Dev : display(recommendation: RecommendationResponse)

else [pas de cache]
    LLMC -> LLMC : buildPrompt(vuln: Vulnerability): str
    LLMC -> LA : complete(prompt: str, model: str): str
    activate LA
    alt [LLM timeout ou erreur]
        LA --> LLMC : raise LLMServiceError
        deactivate LA
        LLMC --> VDP : raise HTTPException(status=503, detail="Service LLM indisponible")
        VDP --> Dev : display(error: "Recommandation non disponible")
    else [LLM répond]
        LA --> LLMC : return rawResponse: str
        deactivate LA
        LLMC -> LLMC : parseResponse(raw: str): RecommendationData
        LLMC -> RE : save(vulnId: int, recommendation: str): Recommendation
        activate RE
        RE --> LLMC : return savedRec
        deactivate RE
        LLMC --> VDP : return RecommendationResponse(explanation, fix, cweRef)
        VDP --> Dev : display(recommendation: RecommendationResponse)
    end
end

deactivate LLMC
deactivate VDP
deactivate Dev

@enduml
```

**Explication** : Le `Developer` demande une recommandation via `VulnerabilityDetailPanel`. `LLMController` vérifie d'abord un cache dans `RecommendationEntity`. Sans cache, il construit le prompt à partir de la vulnérabilité, le soumet à `LLMAdapter` (interfaçant OpenAI ou un modèle local). En cas d'erreur LLM, une erreur 503 est retournée. La recommandation est mise en cache pour les requêtes futures.

---

## Sprint 7 — API Keys, Audit Logs & Notifications

### Objectif du Sprint
Implémenter la gestion des clés API pour l'intégration programmatique, le journal d'audit complet des actions sensibles, et le système de notifications temps réel (cloche + Socket.IO).

### User Stories

| ID | User Story | Critères d'acceptation | Points |
|----|-----------|------------------------|--------|
| US-07-1 | En tant que **Developer**, je veux générer des clés API afin d'intégrer InvisiThreat dans mes pipelines CI/CD. | - Génération clé avec nom, expiration optionnelle<br>- Clé visible une seule fois à la création<br>- Liste des clés actives sans valeur complète | 5 |
| US-07-2 | En tant qu'**Admin**, je veux consulter les journaux d'audit afin de surveiller les actions sensibles sur la plateforme. | - Filtres par utilisateur, action, date<br>- Pagination<br>- Export possible | 3 |
| US-07-3 | En tant qu'**Utilisateur**, je veux recevoir des notifications en temps réel afin d'être alerté des événements importants. | - Cloche de notification avec badge<br>- Notifications : scan terminé, vulnérabilité assignée, rôle modifié<br>- Marquer comme lu / tout marquer | 3 |
| US-07-4 | En tant que **Developer**, je veux consulter mes propres journaux d'activité afin de suivre mes actions sur la plateforme. | - Vue "My Activity" accessible dans les settings<br>- Filtrée aux actions propres à l'utilisateur | 2 |

**Total Sprint 7 : 13 points**

### Tâches techniques

**Backend**
- [ ] `POST /api-keys` — génération clé API (hash SHA-256 stocké)
- [ ] `GET /api-keys` — liste des clés (sans secret complet)
- [ ] `DELETE /api-keys/{id}` — révocation
- [ ] Middleware `get_user_from_api_key` — auth par clé API
- [ ] `GET /audit-logs` (Admin) — journal global paginé
- [ ] `GET /me/audit-logs` — journal personnel
- [ ] Service notification : `create_notification`, `mark_as_read`
- [ ] Socket.IO : événement `notification` en temps réel
- [ ] `GET /notifications` + `PATCH /notifications/{id}/read` + `PATCH /notifications/read-all`

**Frontend**
- [ ] Page `AuditLogsPage.jsx` — consultation logs
- [ ] Composant `NotificationBell.jsx` — cloche avec badge
- [ ] Page `NotificationsPage.jsx` — vue complète
- [ ] Onglet API Keys dans `SettingsPage.jsx`

**Base de données**
- [ ] Modèles `ApiKey` (hash), `AuditLog`, `Notification`
- [ ] Migration Alembic

**Tests**
- [ ] Test génération + authentification par clé API
- [ ] Test audit log : action journalisée après chaque opération sensible
- [ ] Test notification temps réel (Socket.IO mock)

---

### Diagramme de séquence : UC-07-1 — Génération d'une Clé API

**Acteur(s)** : Developer

```plantuml
@startuml UC-07-1_GenerateAPIKey

skinparam participant {
    BackgroundColor<<boundary>> #DDEEFF
    BackgroundColor<<control>> #FFFACD
    BackgroundColor<<entity>> #DFFFDF
    BorderColor Black
}
skinparam sequenceArrowThickness 2
title UC-07-1 : Génération d'une clé API

actor "Developer" as Dev
participant "APIKeySettingsPanel\n«boundary»" as AKSP <<boundary>>
participant "APIKeyController\n«control»" as AKC <<control>>
participant "AuditService\n«control»" as AS <<control>>
participant "APIKeyEntity\n«entity»" as AKE <<entity>>

activate Dev
Dev -> AKSP : requestNewKey(name: str, expiresAt: date|None): FormData
activate AKSP

AKSP -> AKC : createApiKey(name: str, userId: int, expiresAt: date|None): APIKeyCreateResponse
activate AKC

AKC -> AKC : generateSecret(): str
AKC -> AKC : hashSecret(secret: str): str

AKC -> AKE : save(userId: int, name: str, keyHash: str, expiresAt: date|None): APIKey
activate AKE
AKE --> AKC : return savedKey
deactivate AKE

AKC -> AS : log(action: "api_key_created", userId: int, keyId: int): None
activate AS
AS --> AKC : return None
deactivate AS

note right of AKC : Le secret en clair est retourné\nune seule fois — jamais stocké

AKC --> AKSP : return APIKeyCreateResponse(id: int, secret: str, name: str)
AKSP --> Dev : display(secret: str, warning: "Copiez la clé maintenant")

deactivate AKC
deactivate AKSP
deactivate Dev

@enduml
```

**Explication** : Le `Developer` crée une clé via `APIKeySettingsPanel`. `APIKeyController` génère un secret cryptographiquement aléatoire, en stocke uniquement le hash SHA-256 dans `APIKeyEntity` (jamais le secret en clair), journalise l'action dans `AuditService`, et retourne le secret en clair une unique fois à l'utilisateur.

---

### Diagramme de séquence : UC-07-3 — Notification Temps Réel

**Acteur(s)** : Utilisateur authentifié

```plantuml
@startuml UC-07-3_RealtimeNotification

skinparam participant {
    BackgroundColor<<boundary>> #DDEEFF
    BackgroundColor<<control>> #FFFACD
    BackgroundColor<<entity>> #DFFFDF
    BorderColor Black
}
skinparam sequenceArrowThickness 2
title UC-07-3 : Notification temps réel

actor "Utilisateur" as User
participant "NotificationBell\n«boundary»" as NB <<boundary>>
participant "SocketIOGateway\n«boundary»" as SIO <<boundary>>
participant "NotificationController\n«control»" as NC <<control>>
participant "NotificationEntity\n«entity»" as NE <<entity>>

activate User
User -> NB : mountComponent(): void
activate NB

NB -> SIO : connect(namespace: "/notifications", JWT): void
activate SIO
SIO --> NB : emit("connected"): void

note over NC : Événement système (scan terminé,\nassignation, changement rôle...)
NC -> NE : save(notification: Notification): Notification
activate NE
NE --> NC : return savedNotif
deactivate NE

NC -> SIO : broadcast(userId: int, "notification", payload: NotifPayload): void
SIO --> NB : receive("notification", {type, message, link}): void
NB --> User : showBadge(count: +1); display(toast: message)

User -> NB : openNotificationPanel(): void
NB -> NC : getNotifications(userId: int, unreadOnly: bool): List[Notification]
activate NC
NC -> NE : findByUserId(userId: int, unreadOnly: bool): List[Notification]
activate NE
NE --> NC : return notifications
deactivate NE
NC --> NB : return notifications: List[NotificationResponse]
deactivate NC
NB --> User : render(notificationList: List)

User -> NB : markAllRead(): void
NB -> NC : markAllAsRead(userId: int): None
activate NC
NC -> NE : updateAll(userId: int, read: true): None
activate NE
NE --> NC : return None
deactivate NE
NC --> NB : return None
deactivate NC
NB --> User : clearBadge()

deactivate SIO
deactivate NB
deactivate User

@enduml
```

**Explication** : `NotificationBell` (boundary UI) s'abonne aux événements Socket.IO via `SocketIOGateway`. Lorsqu'un événement système se produit, `NotificationController` persiste la notification dans `NotificationEntity` et diffuse un événement au client ciblé. L'utilisateur peut consulter, puis marquer toutes les notifications comme lues.

---

## Sprint 8 — Intégration, Tests & Documentation

### Objectif du Sprint
Finaliser la plateforme avec des tests d'intégration end-to-end, corriger les bugs identifiés, documenter l'API et le projet, et préparer le rapport académique final.

### User Stories

| ID | User Story | Critères d'acceptation | Points |
|----|-----------|------------------------|--------|
| US-08-1 | En tant que **Tech Lead**, je veux des tests d'intégration E2E couvrant les flux critiques afin de valider la stabilité de la plateforme. | - Couverture tests ≥ 80% sur les routes critiques<br>- Tests : auth, scans, workflow vulnérabilités, notifications<br>- CI exécute tous les tests | 8 |
| US-08-2 | En tant que **Tech Lead**, je veux une documentation API complète afin que les intégrateurs puissent utiliser InvisiThreat. | - Swagger/OpenAPI auto-généré via FastAPI<br>- Description de chaque endpoint<br>- Exemples de requêtes/réponses | 3 |
| US-08-3 | En tant que **PM**, je veux que le rapport de projet final soit rédigé afin de présenter InvisiThreat à l'évaluation académique. | - Rapport inclut : contexte, architecture, sprints, UML, résultats<br>- Diagrammes de classes et de séquences inclus | 5 |
| US-08-4 | En tant que **DevOps**, je veux que le déploiement Docker soit optimisé et documenté afin de faciliter la mise en production. | - `docker-compose up --build` sans erreur<br>- Variables d'env documentées<br>- Health checks configurés | 3 |
| US-08-5 | En tant que **QA**, je veux que tous les bugs critiques détectés soient corrigés afin que la plateforme soit stable. | - Backlog de bugs priorisé<br>- Tous les bugs P0/P1 corrigés<br>- Tests de non-régression ajoutés | 5 |

**Total Sprint 8 : 24 points**

### Tâches techniques

**Backend**
- [ ] Compléter suite de tests Pytest (intégration + unitaires)
- [ ] Audit sécurité : OWASP Top 10 review
- [ ] Optimisation queries N+1 SQLAlchemy
- [ ] Révision et complétion des docstrings FastAPI (OpenAPI)

**Frontend**
- [ ] Tests composants critiques (Vitest / React Testing Library)
- [ ] Vérification accessibilité (ARIA labels)
- [ ] Optimisation bundle (lazy loading routes)

**Documentation**
- [ ] `README.md` complet avec guide d'installation
- [ ] Documentation architecture dans `docs/`
- [ ] Rapport académique final avec UML

**DevOps**
- [ ] Optimisation Dockerfile (multi-stage build)
- [ ] Configuration health checks Docker
- [ ] Review pipeline CI/CD final

---

### Diagramme de séquence : UC-08-1 — Cycle de Test E2E — Flux Scan Complet

**Acteur(s)** : TestRunner (CI/CD)

```plantuml
@startuml UC-08-1_E2E_ScanFlow

skinparam participant {
    BackgroundColor<<boundary>> #DDEEFF
    BackgroundColor<<control>> #FFFACD
    BackgroundColor<<entity>> #DFFFDF
    BorderColor Black
}
skinparam sequenceArrowThickness 2
title UC-08-1 : Test E2E — Flux complet scan SAST

actor "TestRunner\n[CI/CD]" as TR
participant "APITestClient\n«boundary»" as ATC <<boundary>>
participant "AuthController\n«control»" as AC <<control>>
participant "ScanController\n«control»" as SC <<control>>
participant "VulnWorkflowController\n«control»" as VWC <<control>>
participant "UserEntity\n«entity»" as UE <<entity>>
participant "ScanEntity\n«entity»" as SE <<entity>>
participant "VulnTaskEntity\n«entity»" as VTE <<entity>>

activate TR
TR -> ATC : POST /auth/login(email, password): LoginResponse
activate ATC
ATC -> AC : login(credentials): LoginResponse
activate AC
AC -> UE : findByEmail(email): User
activate UE
UE --> AC : return testUser
deactivate UE
AC --> ATC : return {accessToken: str}
deactivate AC
ATC --> TR : assert status==200; extractToken()

TR -> ATC : POST /projects(token, projectData): ProjectResponse
ATC -> SC : createProject(data, user): ProjectResponse
activate SC
SC --> ATC : return {id: projectId}
deactivate SC
ATC --> TR : assert status==201; extractProjectId()

TR -> ATC : POST /projects/{id}/scans(token, scanData): ScanResponse
ATC -> SC : createScan(projectId, scanCreate): ScanResponse
activate SC
SC -> SE : save(scan): Scan
activate SE
SE --> SC : return scan
deactivate SE
SC --> ATC : return {id: scanId, status: "pending"}
deactivate SC
ATC --> TR : assert status==201

loop [polling jusqu'à status=="completed", timeout=60s]
    TR -> ATC : GET /projects/{id}/scans/{scanId}
    ATC -> SC : getScan(scanId): ScanResponse
    activate SC
    SC -> SE : findById(scanId): Scan
    activate SE
    SE --> SC : return scan
    deactivate SE
    SC --> ATC : return scan
    deactivate SC
    ATC --> TR : check status
end

TR -> ATC : GET /projects/{id}/security/vulnerability-tasks
ATC -> VWC : getTasks(projectId): List[VulnTask]
activate VWC
VWC -> VTE : findByProjectId(projectId): List
activate VTE
VTE --> VWC : return tasks
deactivate VTE
VWC --> ATC : return tasks
deactivate VWC
ATC --> TR : assert tasks.length > 0

TR -> ATC : PATCH /vulnerability-tasks/{taskId}(status: "resolved")
ATC -> VWC : updateTask(taskId, update): VulnTaskResponse
activate VWC
VWC -> VTE : update(task): VulnerabilityTask
activate VTE
VTE --> VWC : return updated
deactivate VTE
VWC --> ATC : return updated
deactivate VWC
ATC --> TR : assert status=="resolved"

TR --> TR : reportTestResults(passed: bool): void
deactivate ATC
deactivate TR

@enduml
```

**Explication** : Le `TestRunner` (CI/CD) simule le flux complet via `APITestClient` (boundary de test). Il enchaîne : authentification → création projet → lancement scan → polling du statut → consultation des tâches de vulnérabilités → résolution d'une tâche. Ce scénario valide l'intégration verticale de toute la chaîne. Les assertions à chaque étape garantissent la non-régression.

---

## Récapitulatif de la Planification

| Sprint | Objectif | Durée | Points |
|--------|---------|-------|--------|
| Sprint 0 | Infrastructure & Architecture | 2 semaines | 16 |
| Sprint 1 | Authentification & RBAC | 2 semaines | 24 |
| Sprint 2 | Gestion Projets & GitHub | 2 semaines | 16 |
| Sprint 3 | Scan SAST | 2 semaines | 23 |
| Sprint 4 | Scan DAST | 2 semaines | 16 |
| Sprint 5 | Workflow Vulnérabilités | 2 semaines | 16 |
| Sprint 6 | Dashboard, Rapports & LLM | 2 semaines | 21 |
| Sprint 7 | API Keys, Audit & Notifications | 2 semaines | 13 |
| Sprint 8 | Intégration, Tests & Documentation | 2 semaines | 24 |
| **Total** | | **18 semaines** | **169 points** |

---

## Référentiel Acteurs & Stéréotypes BCE

### Acteurs identifiés

| Acteur | Description |
|--------|-------------|
| Admin | Administrateur système — tous droits |
| Developer | Développeur — scans, projets, vulnérabilités |
| Security Manager | Responsable sécurité — workflow vulnérabilités, rapports |
| Viewer | Lecture seule |
| TestRunner | Agent CI/CD automatisé |

### Convention stéréotypes BCE

| Stéréotype | Notation PlantUML | Rôle dans les diagrammes |
|-----------|-------------------|--------------------------|
| `«boundary»` | `<<boundary>>` | Formulaires UI, clients API, gateway Socket.IO |
| `«control»` | `<<control>>` | Controllers FastAPI, Services, Workers Celery |
| `«entity»` | `<<entity>>` | Modèles SQLAlchemy, entités persistées en DB |

> **Règle invariante** : Tout flux respecte strictement la séquence `Acteur → «boundary» → «control» → «entity»`. Aucune interaction directe Acteur ↔ «entity» n'est autorisée.
