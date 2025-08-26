# Jurinorm

Projet test de brique de normalisation commune pour les judilibre

## Etape 1 :

1. Jurinorm expose une API qui permet de récupérer les décisions collectées et "pré-normalisées" par les briques de collecte
2. Jurinorm appelle le zonage sur ces décisions
3. Jurinorm applique les règles de filtrage qui sont actuelement appliquées dans dbdser-api sur ces décisions
4. Jurinorm effectue le calcul de diff mineur/majeure en fonction de la décision déjà présente dans notre base de donnée (effectué dans juritj et juritcom uniquement pour l'instant)
5. Jurinorm enregistre la décision dans la base SDER via dbsder-api

## Etape 2 :

1. Jurinorm envoie la décision a l'API de NLP pour récupérer les entités et les mises en doute
2. Jurinorm calcule le circuit de relecture de chaque décision et oriente la décision (passage par label ou non)

## Etape 3 :

1. Jurinorm appelle le endpoint qui permet de récupérer les termes de remplacement et les stocke dans la collection adhoc

## Etape 4 :

1. Jurinorm est capable de recevoir des décision "brutes" et s'occupe de la normalisation totale des décisions. Les briques de collecte se bornent a collecter les décisions, elles deviennent des interfaces techniques.
