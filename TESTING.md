# Guide de Test - NovaCare POC

## 🚀 Préparation

### 1. Démarrer tous les services

```bash
cd /Users/theysaid/work/urbanisation
docker-compose up -d
```

### 2. Vérifier que tous les services sont démarrés

```bash
docker-compose ps
```

Tous les services doivent être en état "Up" ou "healthy".

### 3. Attendre que les services soient prêts

Attendez environ 30-60 secondes pour que tous les services soient complètement démarrés, surtout :
- Kong (nécessite PostgreSQL)
- Camunda BPM
- Services Java (compilation Maven)

---

## ✅ Tests de Base (Health Checks)

### Test 1 : Patient-Core-Service
```bash
curl http://localhost:8080/actuator/health
```
**Résultat attendu :** `{"status":"UP"}`

### Test 2 : Billing-Service
```bash
curl http://localhost:3000/health
```
**Résultat attendu :** `{"status":"OK","service":"billing-service"}`

### Test 3 : Cardio-Consultation-Service
```bash
curl http://localhost:5001/health
```
**Résultat attendu :** `{"status":"OK","service":"cardio-consultation-service"}`

### Test 4 : Local-Appointment-Service
```bash
curl http://localhost:8002/health
```
**Résultat attendu :** `{"status":"OK","service":"local-appointment-service"}`

### Test 5 : Notification-Service
```bash
curl http://localhost:8083/health
```
**Résultat attendu :** `{"status":"OK","service":"notification-service"}`

### Test 6 : ESB Central
```bash
curl http://localhost:8081/actuator/health
```
**Résultat attendu :** Status HTTP 200

### Test 7 : ESB Local
```bash
curl http://localhost:8082/actuator/health
```
**Résultat attendu :** Status HTTP 200

### Test 8 : Kong API Gateway
```bash
curl http://localhost:8001/
```
**Résultat attendu :** Informations sur Kong

### Test 9 : Camunda BPM
```bash
curl http://localhost:8084/camunda
```
**Résultat attendu :** Page HTML de Camunda (ou redirection)

---

## 📋 Tests Fonctionnels

### Scénario A : Admission Patient & Synchronisation

#### Étape 1 : Vérifier qu'un patient existe au siège
```bash
curl http://localhost:8080/api/patients/1
```

**Résultat attendu :**
```json
{
  "id": 1,
  "cin": "12345678",
  "firstName": "Ahmed",
  "lastName": "Tounsi",
  ...
}
```

#### Étape 2 : Vérifier que le patient n'existe pas localement (El Hayet)
```bash
curl http://localhost:5001/api/local_patient/cin/12345678
```

**Résultat attendu :** `404 Not Found` ou `{"error":"Patient non trouvé localement"}`

#### Étape 3 : Check-in via ESB Local (Scénario Principal)
```bash
curl "http://localhost:8082/api/checkin?cin=12345678"
```

**Ce qui devrait se passer :**
1. ESB Local cherche dans la base locale → Non trouvé
2. ESB Local appelle ESB Central
3. ESB Central interroge Patient-Core-Service → Trouvé
4. Synchronisation automatique vers la base locale

**Résultat attendu :** Données du patient en JSON

#### Étape 4 : Vérifier que le patient est maintenant synchronisé localement
```bash
curl http://localhost:5001/api/local_patient/cin/12345678
```

**Résultat attendu :** Patient trouvé avec les données synchronisées

---

### Scénario B : Parcours Soin vers Facturation

#### Étape 1 : Créer une consultation cardiaque
```bash
curl -X POST http://localhost:5001/api/consultation \
  -H "Content-Type: application/json" \
  -d '{
    "patientId": "1",
    "doctorId": "doc1",
    "diagnosis": "Examen cardiaque de routine",
    "prescription": ["Aspirine 100mg"],
    "acts": [
      {"code": "CARD001", "description": "Consultation cardiologie", "price": 150},
      {"code": "ECG001", "description": "Électrocardiogramme", "price": 80}
    ]
  }'
```

**Résultat attendu :** Consultation créée avec un ID

#### Étape 2 : Récupérer les consultations d'un patient
```bash
curl http://localhost:5001/api/consultation/patient/1
```

**Résultat attendu :** Liste des consultations en JSON

#### Étape 3 : Générer une facture
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

**Résultat attendu :**
```json
{
  "success": true,
  "invoice": {
    "invoiceId": "...",
    "invoiceNumber": "INV-...",
    "total": 230,
    ...
  }
}
```

#### Étape 4 : Envoyer une notification
```bash
curl -X POST http://localhost:8083/api/notifications/send \
  -H "Content-Type: application/json" \
  -d '{
    "to": "patient@example.com",
    "subject": "Votre facture NovaCare",
    "body": "Votre facture est prête. Merci de votre visite.",
    "type": "email"
  }'
```

**Résultat attendu :**
```json
{
  "success": true,
  "messageId": "msg-...",
  "message": "Notification email envoyée avec succès à patient@example.com"
}
```

---

## 🔍 Tests via API Gateway (Kong)

### Test 1 : Accéder au Patient-Core-Service via Kong
```bash
curl http://localhost:8000/api/patients/1
```

**Note :** Vous devez d'abord configurer les routes dans Kong. Voir la section "Configuration Kong" ci-dessous.

---

## 📊 Tests Avancés

### Test : Créer un nouveau patient au siège
```bash
curl -X POST http://localhost:8080/api/patients \
  -H "Content-Type: application/json" \
  -d '{
    "cin": "87654321",
    "firstName": "Fatima",
    "lastName": "Ben Ali",
    "dateOfBirth": "1990-03-20",
    "email": "fatima.benali@example.com",
    "phone": "+216 98 765 432",
    "address": "Sfax, Tunisie",
    "allergies": ["Iode"],
    "medicalHistory": ["Asthme"]
  }'
```

### Test : Créer un rendez-vous
```bash
curl -X POST http://localhost:8002/api/appointments \
  -H "Content-Type: application/json" \
  -d '{
    "patientId": "1",
    "doctorId": "doc1",
    "date": "2024-12-15",
    "time": "10:00",
    "reason": "Suivi cardiaque",
    "status": "scheduled"
  }'
```

### Test : Récupérer tous les rendez-vous
```bash
curl http://localhost:8002/api/appointments
```

---

## 🧪 Script de Test Automatisé

Utilisez le script fourni pour tester tous les scénarios :

```bash
chmod +x test-scenarios.sh
./test-scenarios.sh
```

**Prérequis :** `curl` et `jq` (optionnel pour le formatage JSON)

---

## 🔧 Configuration Kong (Optionnel)

Pour tester via l'API Gateway, configurez les routes :

### 1. Ajouter le service Patient
```bash
curl -i -X POST http://localhost:8001/services \
  --data "name=patient-service" \
  --data "url=http://patient-core-service:8080"
```

### 2. Ajouter la route
```bash
curl -i -X POST http://localhost:8001/services/patient-service/routes \
  --data "paths[]=/api/patients" \
  --data "strip_path=false"
```

### 3. Tester via Kong
```bash
curl http://localhost:8000/api/patients/1
```

---

## 🐛 Dépannage

### Vérifier les logs d'un service
```bash
docker-compose logs -f patient-core-service
```

### Redémarrer un service
```bash
docker-compose restart patient-core-service
```

### Vérifier les logs de tous les services
```bash
docker-compose logs -f
```

### Vérifier la connectivité réseau entre containers
```bash
docker exec -it patient-core-service ping cardio-consultation-service
```

---

## 📝 Checklist de Test

- [ ] Tous les services démarrent sans erreur
- [ ] Tous les health checks passent
- [ ] Patient existe au siège (Patient-Core-Service)
- [ ] Patient n'existe pas localement (Cardio-Consultation-Service)
- [ ] Check-in via ESB Local fonctionne
- [ ] Patient synchronisé localement après check-in
- [ ] Consultation peut être créée
- [ ] Facture peut être générée
- [ ] Notification peut être envoyée
- [ ] Rendez-vous peut être créé

---

## 🎯 Tests de Performance (Optionnel)

### Test de charge simple
```bash
# 10 requêtes simultanées
for i in {1..10}; do
  curl http://localhost:8080/api/patients/1 &
done
wait
```

---

## 📚 Ressources

- **Camunda Cockpit** : http://localhost:8084/camunda (demo/demo)
- **Kong Admin API** : http://localhost:8001
- **Documentation** : Voir README.md et ARCHITECTURE.md

