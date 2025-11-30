# Architecture NovaCare POC

## Vue d'Ensemble

Ce POC démontre l'urbanisation des systèmes informatiques pour NovaCare Medical Group, résultant de la fusion de trois cliniques.

## Architecture en 3 Machines (Containers Docker)

### Machine 1 : Siège (Hannibal - HQ)
**IP Logique :** 172.20.0.10 (simulé via Docker network)

#### Services :
1. **Patient-Core-Service** (Port 8080)
   - Technologie : Java 17 + Spring Boot 3.1.5
   - Rôle : Référentiel unique des patients (MPI - Master Patient Index)
   - Base de données : H2 (fichier)
   - API : REST (JSON/XML)

2. **Billing-Service** (Port 3000)
   - Technologie : Node.js 18 + Express
   - Rôle : Génération de factures PDF
   - Dépendances : Patient-Core-Service

3. **ESB Central** (Port 8081)
   - Technologie : Apache Camel 4.0 + Spring Boot
   - Rôle : Médiation centrale, transformation de données
   - Routes : Recherche patient, création patient, facturation

### Machine 2 : Clinique Spécialisée (El Hayet)
**IP Logique :** 172.20.0.20 (simulé via Docker network)

#### Services :
1. **Cardio-Consultation-Service** (Port 5001 exposé, 5000 interne)
   - Technologie : Python 3.11 + Flask
   - Rôle : Gestion des consultations cardiaques locales
   - Stockage : JSON files
   - API : REST (JSON)

2. **Local-Appointment-Service** (Port 8002 exposé, 80 interne)
   - Technologie : PHP 8.2 + Apache
   - Rôle : Gestion des rendez-vous locaux
   - Stockage : JSON files
   - API : REST (JSON)

3. **ESB Local** (Port 8082)
   - Technologie : Apache Camel 4.0 + Spring Boot
   - Rôle : Médiation locale, proxy vers ESB Central
   - Routes : Check-in patient, synchronisation

### Machine 3 : Orchestration & Accès (Cloud)
**IP Logique :** 172.20.0.30 (simulé via Docker network)

#### Services :
1. **API Gateway** (Kong) (Ports 8000/8001)
   - Technologie : Kong API Gateway
   - Rôle : Point d'entrée unique, routage, sécurité
   - Base de données : PostgreSQL 13

2. **Camunda BPM** (Port 8084)
   - Technologie : Camunda BPM Platform
   - Rôle : Orchestration des processus métier
   - Base de données : H2 (fichier)

3. **Notification-Service** (Port 8083)
   - Technologie : Go 1.21
   - Rôle : Envoi de notifications (email, SMS)
   - API : REST (JSON)

## Flux de Communication

### Scénario A : Admission Patient & Synchronisation

```
Frontend (El Hayet)
    ↓
API Gateway (Kong) :8000
    ↓
ESB Local :8082
    ↓
    ├─→ Cardio-Consultation-Service :5000 (Recherche locale)
    │   └─→ Si trouvé : Retour immédiat
    │
    └─→ Si non trouvé :
        ↓
        ESB Central :8081
            ↓
            Patient-Core-Service :8080 (Recherche au siège)
                ↓
                Si trouvé : Synchronisation
                    ↓
                    ESB Central :8081 (Transformation XML→JSON)
                        ↓
                        ESB Local :8082
                            ↓
                            Cardio-Consultation-Service :5000 (Création locale)
```

### Scénario B : Parcours Soin vers Facturation

```
Cardio-Consultation-Service :5000 (Consultation terminée)
    ↓
Camunda BPM :8084 (Déclenchement processus)
    ↓
    ├─→ ESB Local :8082 (Collecte codes actes)
    │   └─→ Cardio-Consultation-Service :5000
    │
    ├─→ ESB Central :8081 (Génération facture)
    │   └─→ Billing-Service :3000
    │       └─→ Patient-Core-Service :8080 (Récupération infos patient)
    │
    └─→ Notification-Service :8083 (Envoi facture)
```

## Technologies Utilisées

### Backend Services
- **Java/Spring Boot** : Services critiques, intégration
- **Node.js/Express** : Services légers, génération PDF
- **Python/Flask** : Services de données, rapidité de développement
- **PHP/Apache** : Simulation de système legacy
- **Go** : Service haute performance

### Middleware & Integration
- **Apache Camel** : ESB pour médiation et transformation
- **Kong** : API Gateway pour routage et sécurité
- **Camunda BPM** : Orchestration des processus métier

### Stockage
- **H2 Database** : Base de données embarquée (Java services)
- **JSON Files** : Stockage simple pour POC (Python, PHP)
- **PostgreSQL** : Base de données pour Kong

## Principes d'Architecture

### 1. Découplage Géographique
- Chaque machine représente un site physique
- Communication via réseau Docker (simulation réseau réel)
- ESB pour abstraction des adresses IP

### 2. Médiation par ESB
- Transformation de formats (XML ↔ JSON)
- Routage intelligent
- Gestion des erreurs
- Logging centralisé

### 3. Orchestration par BPMN
- Processus métier modélisés
- Traçabilité complète
- Gestion des exceptions
- Monitoring via Camunda Cockpit

### 4. Point d'Entrée Unique
- API Gateway (Kong) comme façade
- Routage basé sur les chemins
- Possibilité d'ajouter authentification, rate limiting, etc.

## Sécurité (POC - Non implémenté)

Pour la production, ajouter :
- Authentification OAuth2/JWT
- HTTPS/TLS
- Rate limiting
- Logging et audit
- Chiffrement des données sensibles

## Scalabilité

- Chaque service peut être scalé indépendamment
- Load balancing possible via Kong
- Base de données partagée pour Patient-Core-Service
- Bases locales pour performance

## Monitoring

- Health checks sur tous les services
- Logs centralisés (via Docker logs)
- Camunda Cockpit pour monitoring BPMN
- Kong Admin API pour monitoring API Gateway


