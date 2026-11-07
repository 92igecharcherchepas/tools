# Bot Shiza — Components V2

Bot Discord autonome avec interface Components V2 grise. Les réglages sont enregistrés par serveur dans `data/guildConfigs.json`.

## Installation

1. Installer Node.js 20 ou plus récent.
2. Dans ce dossier : `npm install`
3. Copier `env.example` vers `.env`, puis renseigner `TOKEN` et `CLIENT_ID`. `GUILD_ID` est facultatif et permet de déployer les commandes immédiatement sur un serveur de test.
4. Lancer `npm start`.

Le bot publie ses commandes slash au démarrage. Dans le portail Discord, active les intents privilégiés **Server Members Intent** et **Message Content Intent**. Ajoute le bot au serveur avec les permissions nécessaires aux fonctions utilisées : voir/envoyer des messages, gérer les salons et rôles, gérer les messages et invitations. Le suivi des invitations requiert aussi la permission **Gérer le serveur**.

## Tickets

- `/ticket config` ouvre le panneau de configuration (réservé aux personnes ayant « Gérer le serveur »).
- Le panneau permet de modifier le titre et les textes, le mode menu déroulant/boutons, les types, les rôles pingés, les rôles ayant accès, la catégorie et le salon de publication.
- `/ticket publish salon` publie le panneau configuré dans le salon choisi.
- Les membres ouvrent un ticket depuis le menu ou les boutons. Un salon privé est créé avec les permissions de l’auteur et des rôles configurés.
- `/claim`, `/close`, `/rename`, `/ticket add` et `/ticket remove` gèrent le ticket courant.

## Autres commandes

- **Config :** `/acces`, `/automod`, `/config`, `/logs`, `/owner`, `/serveurs`
- **Utilitaires :** `/cinvite`, `/compteur`, `/dero`, `/embed`, `/everyone`, `/ghostping`, `/leaderboard`, `/menu`, `/report`, `/soutien`, `/sync`, `/welcome`
- **Giveaway :** `/check`, `/giveaway`
- **Invitations :** `/config-invite`, `/invite`, `/lb-invite`, `/reset-invite`

Les commandes de gestion demandent la permission serveur appropriée ou un rôle autorisé par `/acces`. `/everyone` refuse les mentions `@everyone` et limite l’annonce à un rôle opt-in de 10 membres maximum.

Le suivi d’invitations compare les utilisations au démarrage et à chaque arrivée. Les invitations vanity ou plusieurs utilisations simultanées peuvent empêcher l’attribution exacte. Le classement vocal est comptabilisé à partir du démarrage du bot ou de la dernière connexion d’un membre.

`/help` liste les commandes disponibles. Certaines options demandent une configuration initiale (salon de logs, salon d’accueil, rôles, etc.).
