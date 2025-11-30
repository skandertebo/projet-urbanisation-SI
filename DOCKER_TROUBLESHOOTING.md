# Dépannage Docker - Images Java

## Problème : Image Docker non trouvée

Si vous rencontrez l'erreur :
```
failed to resolve source metadata for docker.io/library/eclipse-temurin:17-jre-jammy
```

### Solution 1 : Utiliser le tag par défaut

Remplacez dans les Dockerfiles :
```dockerfile
FROM eclipse-temurin:17-jre-jammy
```

Par :
```dockerfile
FROM eclipse-temurin:17
```

**Note :** `eclipse-temurin:17` contient le JDK complet au lieu du JRE seulement, mais fonctionne parfaitement pour exécuter les applications.

### Solution 2 : Utiliser Amazon Corretto (Alternative)

Si Eclipse Temurin ne fonctionne pas, vous pouvez utiliser Amazon Corretto :

```dockerfile
FROM amazoncorretto:17
```

### Solution 3 : Vérifier les tags disponibles

Pour voir tous les tags disponibles pour Eclipse Temurin :
```bash
curl -s https://registry.hub.docker.com/v2/repositories/library/eclipse-temurin/tags?page_size=100 | jq -r '.results[].name' | grep "17"
```

### Fichiers à modifier

Si vous devez changer l'image, modifiez ces fichiers :
- `machine1/patient-core-service/Dockerfile` (ligne 13)
- `machine1/esb-central/Dockerfile` (ligne 10)
- `machine2/esb-local/Dockerfile` (ligne 10)

### Test rapide

Pour tester si une image fonctionne :
```bash
docker pull eclipse-temurin:17
```

Si cette commande réussit, vous pouvez utiliser ce tag dans vos Dockerfiles.


