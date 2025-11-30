# Guide de Démarrage Rapide - NovaCare POC

## 🚀 Démarrage en 3 étapes

### 1. Prérequis
- Docker et Docker Compose installés
- Au moins 4GB de RAM disponible
- Ports libres : 3000, 5001, 8000, 8001, 8002, 8080, 8081, 8082, 8083, 8084

### 2. Construction et Lancement

```bash
# Construire et démarrer tous les services
docker-compose up --build -d

# Vérifier que tous les services sont démarrés
docker-compose ps
```

### 3. Accès aux Services

Une fois démarrés, accédez aux services :

- **Patient-Core-Service** : http://localhost:8080
- **Billing-Service** : http://localhost:3000
- **ESB Central** : http://localhost:8081
- **Cardio-Consultation-Service** : http://localhost:5001
- **Local-Appointment-Service** : http://localhost:8002
- **ESB Local** : http://localhost:8082
- **Notification-Service** : http://localhost:8083
- **API Gateway (Kong)** : http://localhost:8000 (Proxy), http://localhost:8001 (Admin)
- **Camunda BPM** : http://localhost:8084

## 🧪 Tests Rapides

### Test 1 : Vérifier le Patient-Core-Service
```bash
curl http://localhost:8080/api/patients/1
```

### Test 2 : Check-in Patient (Scénario Principal)
```bash
# Rechercher un patient par CIN via l'ESB Local
curl "http://localhost:8082/api/checkin?cin=12345678"
```

### Test 3 : Créer une Consultation
```bash
curl -X POST http://localhost:5001/api/consultation \
  -H "Content-Type: application/json" \
  -d '{
    "patientId": "1",
    "doctorId": "doc1",
    "diagnosis": "Examen cardiaque de routine",
    "acts": [
      {"code": "CARD001", "description": "Consultation cardiologie", "price": 150},
      {"code": "ECG001", "description": "Électrocardiogramme", "price": 80}
    ]
  }'
```

### Test 4 : Générer une Facture
```bash
curl -X POST http://localhost:3000/api/billing/generate \
  -H "Content-Type: application/json" \
  -d '{
    "patientId": "1",
    "consultationId": "1",
    "acts": [
      {"code": "CARD001", "description": "Consultation cardiologie", "price": 150},
      {"code": "ECG001", "description": "Électrocardiogramme", "price": 80}
    ]
  }'
```

## 📊 Scénarios Métier

### Scénario A : Admission Patient & Synchronisation

1. Le réceptionniste d'El Hayet cherche un patient par CIN
2. L'ESB Local recherche d'abord dans la base locale
3. Si non trouvé, l'ESB Local appelle l'ESB Central
4. L'ESB Central interroge le Patient-Core-Service
5. Si trouvé, synchronisation automatique vers la base locale

**Test :**
```bash
curl "http://localhost:8082/api/checkin?cin=12345678"
```

### Scénario B : Parcours Soin vers Facturation

1. Le médecin termine une consultation
2. Camunda collecte les codes actes
3. Génération de la facture via Billing-Service
4. Envoi de la facture par email via Notification-Service

## 🔧 Dépannage

### Vérifier les logs
```bash
# Tous les services
docker-compose logs -f

# Un service spécifique
docker-compose logs -f patient-core-service
```

### Redémarrer un service
```bash
docker-compose restart patient-core-service
```

### Arrêter tous les services
```bash
docker-compose down
```

### Nettoyer complètement (supprime aussi les volumes)
```bash
docker-compose down -v
```

## 📝 Notes Importantes

- Les services Java nécessitent Maven pour la compilation (fait automatiquement dans Docker)
- Les données sont persistées dans des volumes Docker
- Camunda nécessite quelques secondes pour démarrer complètement
- Kong nécessite la base de données PostgreSQL pour fonctionner


