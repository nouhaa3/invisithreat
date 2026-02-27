# Rôles et Permissions - InvisiThreat

## Vue d'ensemble

InvisiThreat utilise un système de contrôle d'accès basé sur les rôles (RBAC) avec 4 rôles principaux.

## Rôles disponibles

### 1. Admin (Administrateur)

**Description:** Administrateur système avec tous les droits

**Permissions:**
- ✅ Gérer les utilisateurs (créer, modifier, supprimer)
- ✅ Attribuer les rôles
- ✅ Gérer les projets (créer, modifier, supprimer, archiver)
- ✅ Consulter le dashboard complet
- ✅ Gérer les membres des projets
- ✅ Accès à toutes les fonctionnalités administratives
- ✅ Configuration du système
- ✅ Gestion des paramètres de sécurité

**Use Cases:**
- Créer et gérer des comptes utilisateurs
- Assigner des rôles aux utilisateurs
- Créer et configurer des projets
- Ajouter/retirer des membres des projets
- Voir toutes les statistiques système

---

### 2. Developer (Développeur)

**Description:** Développeur avec accès aux analyses et gestion des dépôts

**Permissions:**
- ✅ Consulter le dashboard (vue développeur)
- ✅ Gérer les membres des projets (si propriétaire)
- ✅ Lancer un scan manuel ou automatique
- ✅ Gérer les dépôts GitHub (connecter, déconnecter, configurer)
- ✅ Marquer les vulnérabilités comme False Positive
- ✅ Consulter les résultats du scan
- ✅ Voir l'historique des scans
- ✅ Commenter les vulnérabilités
- ❌ Supprimer des projets
- ❌ Gérer les utilisateurs système

**Use Cases:**
- Connecter un dépôt GitHub au projet
- Lancer un scan de sécurité sur le code
- Consulter les vulnérabilités détectées
- Marquer des faux positifs
- Suivre l'évolution de la sécurité du code
- Collaborer avec l'équipe sur les résolutions

---

### 3. Security Manager (Responsable Sécurité)

**Description:** Responsable sécurité avec focus sur les analyses et rapports

**Permissions:**
- ✅ Consulter le dashboard (vue sécurité)
- ✅ Consulter les résultats du scan
- ✅ Générer des rapports de sécurité (PDF, Excel, JSON)
- ✅ Consulter les vulnérabilités détaillées
- ✅ Prioriser les vulnérabilités (Critical, High, Medium, Low)
- ✅ Consulter les métriques de sécurité
- ✅ Générer des recommandations assistées par IA
- ✅ Voir les tendances de sécurité
- ✅ Exporter les données de sécurité
- ❌ Lancer des scans
- ❌ Marquer des false positives
- ❌ Gérer les dépôts

**Use Cases:**
- Générer un rapport de sécurité mensuel
- Prioriser les vulnérabilités critiques
- Analyser les tendances de sécurité
- Obtenir des recommandations de l'IA
- Exporter les métriques pour la direction
- Suivre la conformité sécurité

---

### 4. Viewer (Lecteur)

**Description:** Accès en lecture seule

**Permissions:**
- ✅ Consulter le dashboard (vue limitée)
- ✅ Voir les informations des projets
- ✅ Consulter les résultats de scan (lecture seule)
- ❌ Modifier quoi que ce soit
- ❌ Lancer des scans
- ❌ Marquer des false positives
- ❌ Générer des rapports
- ❌ Gérer les membres

**Use Cases:**
- Voir l'état de sécurité des projets
- Consulter les vulnérabilités
- Suivre les progrès de résolution
- Accès pour stakeholders externes

---

## Matrice de permissions

| Action | Admin | Developer | Security Manager | Viewer |
|--------|-------|-----------|------------------|--------|
| Gérer utilisateurs | ✅ | ❌ | ❌ | ❌ |
| Attribuer rôles | ✅ | ❌ | ❌ | ❌ |
| Créer projets | ✅ | ✅ | ❌ | ❌ |
| Gérer projets | ✅ | ✅ (propriétaire) | ❌ | ❌ |
| Gérer membres | ✅ | ✅ (propriétaire) | ❌ | ❌ |
| Lancer scans | ✅ | ✅ | ❌ | ❌ |
| Voir résultats scans | ✅ | ✅ | ✅ | ✅ (limité) |
| Marquer false positives | ✅ | ✅ | ❌ | ❌ |
| Générer rapports | ✅ | ❌ | ✅ | ❌ |
| Prioriser vulnérabilités | ✅ | ❌ | ✅ | ❌ |
| Voir métriques sécurité | ✅ | ✅ (projet) | ✅ | ✅ (limité) |
| Gérer dépôts GitHub | ✅ | ✅ | ❌ | ❌ |
| Configuration système | ✅ | ❌ | ❌ | ❌ |
| Dashboard complet | ✅ | ✅ (projets) | ✅ (sécurité) | ✅ (lecture) |

---

## Attribution des rôles

### Par défaut lors de l'inscription
- Nouveau compte: **Viewer** (par défaut)
- Peut être changé lors de la création par un Admin

### Workflow typique
1. Utilisateur s'inscrit → Rôle Viewer automatique
2. Admin examine le profil
3. Admin attribue le rôle approprié (Developer, Security Manager, ou Admin)

### Hiérarchie des permissions
`
Admin > Security Manager = Developer > Viewer
`

Note: Security Manager et Developer ont des permissions **différentes** mais équivalentes en niveau.

---

## Implémentation technique

### Base de données
Rôles stockés dans la table oles:
`sql
SELECT * FROM roles;
`

### JWT Token
Le rôle est inclus dans le JWT payload:
`json
{
  "sub": "user_uuid",
  "role": "Admin",
  "exp": 1234567890
}
`

### Validation des permissions
Utiliser des decorators pour protéger les routes:
`python
@router.get("/admin-only")
async def admin_endpoint(user: User = Depends(require_role("Admin"))):
    ...
`

---

## Prochaines étapes

- [ ] Implémenter des decorators @require_role()
- [ ] Créer des policies de permissions granulaires
- [ ] Ajouter la notion de "propriétaire de projet"
- [ ] Implémenter l'audit log des actions sensibles
