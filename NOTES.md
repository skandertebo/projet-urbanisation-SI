# Notes Importantes

## ⚠️ Correction XML Requise

Les fichiers `pom.xml` contiennent une erreur XML : ils utilisent `<n>` au lieu de `<name>`.

**Fichiers à corriger :**
- `machine1/patient-core-service/pom.xml` (ligne 18)
- `machine1/esb-central/pom.xml` (ligne 18)
- `machine2/esb-local/pom.xml` (ligne 18)

**Correction :**
Remplacer `<n>...</n>` par `<name>...</name>` dans chaque fichier.

Exemple :
```xml
<!-- Avant -->
<n>Patient Core Service</n>

<!-- Après -->
<name>Patient Core Service</name>
```

## 🐳 Docker Build Notes

### Services Java (Maven)
Les services Java sont construits en deux étapes :
1. Build avec Maven (dans l'image `maven:3.9-eclipse-temurin-17`)
2. Runtime avec JRE seulement (image `eclipse-temurin:17-jre-jammy`)
   - Si ce tag ne fonctionne pas, utiliser `eclipse-temurin:17` (JDK complet, mais fonctionne)

Cela réduit la taille des images finales.

### Services Node.js
- Utilise `node:18-alpine` pour une image légère
- Les dépendances sont installées avant le code source (optimisation du cache Docker)

### Services Python
- Utilise `python:3.11-slim`
- Installation de `gcc` nécessaire pour certaines dépendances

### Services PHP
- Utilise `php:8.2-apache`
- Mod_rewrite activé pour les routes

### Services Go
- Build multi-stage pour réduire la taille
- Image finale basée sur `alpine:latest`

## 🔧 Configuration Kong

Kong nécessite une base de données PostgreSQL. La configuration est faite via :
- Variables d'environnement
- Migration automatique au démarrage

Pour configurer les routes dans Kong, utiliser l'Admin API :
```bash
# Exemple : Ajouter un service
curl -i -X POST http://localhost:8001/services \
  --data "name=patient-service" \
  --data "url=http://patient-core-service:8080"
```

## 📊 Camunda BPM

Les processus BPMN sont chargés depuis :
- `machine3/camunda/processes/`

Pour déployer un processus :
1. Accéder à http://localhost:8084/camunda
2. Se connecter (demo/demo par défaut)
3. Aller dans "Processes" → "Deploy Process"
4. Uploader le fichier `.bpmn`

## 🧪 Tests

Le script `test-scenarios.sh` teste tous les scénarios principaux.

**Prérequis :**
- `curl` installé
- `jq` installé (optionnel, pour le formatage JSON)

## 📝 Données de Test

Un patient de test est créé automatiquement au démarrage du Patient-Core-Service :
- **CIN** : 12345678
- **Nom** : Ahmed Tounsi
- **Allergies** : Pénicilline, Aspirine
- **Historique** : Hypertension, Diabète type 2

## 🔍 Dépannage

### Services Java ne démarrent pas
- Vérifier que Maven peut compiler (logs Docker)
- Vérifier les ports disponibles
- Vérifier la mémoire disponible

### Kong ne démarre pas
- Vérifier que PostgreSQL est démarré
- Vérifier les logs de migration
- Attendre quelques secondes après le démarrage de PostgreSQL

### Camunda ne charge pas les processus
- Vérifier que le volume est monté correctement
- Vérifier les permissions des fichiers
- Les processus doivent être dans `/camunda/webapps/processes/`

### Erreurs de connexion entre services
- Vérifier que tous les services sont sur le même réseau Docker (`novacare-network`)
- Vérifier les noms des services (doivent correspondre aux noms dans docker-compose.yml)
- Vérifier les health checks

## 🚀 Améliorations Futures

Pour transformer ce POC en production :

1. **Sécurité**
   - Ajouter authentification (OAuth2/JWT)
   - HTTPS/TLS
   - Rate limiting
   - Chiffrement des données sensibles

2. **Base de données**
   - Remplacer H2 par PostgreSQL/MySQL
   - Remplacer JSON files par vraies bases de données
   - Ajouter réplication et backup

3. **Monitoring**
   - Prometheus + Grafana
   - ELK Stack pour les logs
   - Alerting

4. **CI/CD**
   - Pipeline Jenkins/GitLab CI
   - Tests automatisés
   - Déploiement automatique

5. **Scalabilité**
   - Kubernetes pour orchestration
   - Load balancing
   - Auto-scaling

