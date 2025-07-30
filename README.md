# Jurinorm

Projet test de brique de normalisation commune pour les judilibre

## Etape 1 :

1. Jurinorm expose une API qui permet de récupérer les décisions collectées et "pré-normalisées" par les briques de collecte
2. Jurinorm appelle le zonage sur ces décisions
3. Jurinorm applique les règles de filtrage qui sont actuelement appliquées dans dbdser-api sur ces décisions
4. Jurinorm enregistre la décision dans la base SDER via dbsder-api

## Etape 2 :

1. Jurinorm envoie la décision a l'API de NLP pour récupérer les entités et les mises en doute
2. Jurinorm calcule le circuit de relecture de chaque décision
