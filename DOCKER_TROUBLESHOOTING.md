# Dépannage Docker - Images Node.js

## Problème : Image Docker non trouvée

Si vous rencontrez l'erreur :
```
failed to resolve source metadata for docker.io/library/node:18-alpine
```

### Solution 1 : Utiliser le tag par défaut

Remplacez dans les Dockerfiles :
```dockerfile
FROM node:18-alpine
```

Par :
```dockerfile
FROM node:18
```

**Note :** `node:18` est l'image standard Node.js, plus grande mais plus complète que l'image Alpine.

### Solution 2 : Utiliser une version LTS différente

Si Node.js 18 ne fonctionne pas, vous pouvez utiliser une autre version LTS :

```dockerfile
FROM node:20-alpine
```

ou

```dockerfile
FROM node:lts-alpine
```

### Solution 3 : Vérifier les tags disponibles

Pour voir tous les tags disponibles pour Node.js :
```bash
curl -s https://registry.hub.docker.com/v2/repositories/library/node/tags?page_size=100 | jq -r '.results[].name' | grep "18"
```

### Fichiers à modifier

Si vous devez changer l'image, modifiez ces fichiers :
- `machine1/patient-core-service/Dockerfile`
- `machine1/esb-central/Dockerfile`
- `machine2/esb-local/Dockerfile`

### Test rapide

Pour tester si une image fonctionne :
```bash
docker pull node:18-alpine
```

Si cette commande réussit, vous pouvez utiliser ce tag dans vos Dockerfiles.

## Problèmes courants avec Node.js

### Problème : npm install échoue

Si `npm install` échoue lors du build Docker, vérifiez :
1. Que le fichier `package.json` est présent
2. Que les dépendances sont correctement définies
3. Que le réseau Docker a accès à npm registry

### Problème : Module non trouvé au runtime

Si vous obtenez "Cannot find module" au runtime :
1. Vérifiez que `npm install --production` est exécuté dans le Dockerfile
2. Vérifiez que tous les fichiers nécessaires sont copiés (notamment `server.js`)
3. Vérifiez que le `WORKDIR` est correctement défini


