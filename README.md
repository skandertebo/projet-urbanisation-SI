# NovaCare Medical Group - POC Urbanisation des Systèmes

## 📋 Présentation

Ce projet est un Proof of Concept (POC) pour l'urbanisation des systèmes informatiques de NovaCare Medical Group, résultant de la fusion de trois cliniques :
- **Hannibal Health Clinic** (Siège)
- **El Hayet Cardiac Center** (Clinique spécialisée)
- **El Amal Physiotherapy & Rehab**

## 🏗️ Architecture

### Machine 1 : Siège (Hannibal - HQ)
- **Patient-Core-Service** (Node.js) - Port 8080
- **Billing-Service** (Node.js) - Port 3000
- **ESB 1 Central** (Node.js) - Port 8081

### Machine 2 : Clinique Spécialisée (El Hayet)
- **Cardio-Consultation-Service** (Python/Flask) - Port 5001
- **Local-Appointment-Service** (PHP) - Port 8002
- **ESB 2 Local** (Node.js) - Port 8082

### Machine 3 : Orchestration & Accès (Cloud)
- **API Gateway** (Kong) - Ports 8000 (Proxy), 8001 (Admin)
- **Camunda BPM** - Port 8084
- **Notification-Service** (Go) - Port 8083

## 🚀 Démarrage Rapide

### Prérequis
- Docker et Docker Compose installés
- Au moins 4GB de RAM disponible

### Lancement

```bash
# Construire et démarrer tous les services
docker-compose up --build

# Ou en arrière-plan
docker-compose up -d --build
```

### Vérification des services

Une fois démarrés, les services sont accessibles sur :

- **Patient-Core-Service** : http://localhost:8080
- **Billing-Service** : http://localhost:3000
- **ESB Central** : http://localhost:8081
- **Cardio-Consultation-Service** : http://localhost:5001
- **Local-Appointment-Service** : http://localhost:8002
- **ESB Local** : http://localhost:8082
- **Notification-Service** : http://localhost:8083
- **API Gateway (Kong)** : http://localhost:8000 (Proxy), http://localhost:8001 (Admin)
- **Camunda BPM** : http://localhost:8084

## 📊 Scénarios Métier

### Processus A : Admission Patient & Synchronisation

1. Le réceptionniste d'El Hayet saisit un nom/CIN
2. L'API Gateway route vers ESB 2 (Local)
3. ESB 2 interroge le Cardio-Consultation-Service
4. Si non trouvé, ESB 2 appelle ESB 1 (Central)
5. ESB 1 interroge le Patient-Core-Service
6. Synchronisation automatique du profil vers la base locale

### Processus B : Parcours Soin vers Facturation

1. Le médecin termine une consultation
2. Camunda collecte les codes actes via ESB 2
3. Camunda envoie les données à ESB 1 pour le Billing-Service
4. Billing-Service génère le PDF de la facture
5. Notification-Service envoie la facture par email au patient

## 🧪 Tests

### Test du Patient-Core-Service
```bash
curl http://localhost:8080/api/patients/1
```

### Test du Cardio-Consultation-Service
```bash
curl http://localhost:5001/api/local_patient/1
```

### Test via API Gateway
```bash
curl http://localhost:8000/api/patients/1
```

## 📁 Structure du Projet

```
urbanisation/
├── machine1/
│   ├── patient-core-service/
│   ├── billing-service/
│   └── esb-central/
├── machine2/
│   ├── cardio-consultation-service/
│   ├── local-appointment-service/
│   └── esb-local/
├── machine3/
│   ├── notification-service/
│   └── camunda/
└── docker-compose.yml
```

## 🔧 Configuration

Les services communiquent via le réseau Docker `novacare-network`. Chaque service peut être configuré via les variables d'environnement dans `docker-compose.yml`.

## 📝 Notes

- Les bases de données utilisent des fichiers JSON/SQLite pour simplifier le POC
- Les ESB utilisent Node.js/Express pour la médiation et le routage
- Camunda BPM orchestre les processus métier
- Kong sert de point d'entrée unique (API Gateway)

## 🛑 Arrêt

```bash
docker-compose down
```

Pour supprimer aussi les volumes :
```bash
docker-compose down -v
```


