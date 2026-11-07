const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  ContainerBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  TextDisplayBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
} = require('discord.js');
const { getConfig, updateConfig } = require('./store');
const { v2: ticketV2 } = require('./tickets');

const command = (name, description) => new SlashCommandBuilder().setName(name).setDescription(description);
const choice = (option, choices) => {
  for (const [name, value] of choices) option.addChoices({ name, value });
  return option;
};
const textChannelTypes = [ChannelType.GuildText, ChannelType.GuildAnnouncement];
const voiceSessions = new Map();
const giveawayTimers = new Map();
const leaderboardTimers = new Map();
const finishingGiveaways = new Set();
function v2(content, rows = [], ephemeral = false) {
  return { ...ticketV2(cap(content, 3900), rows, ephemeral), allowedMentions: { parse: [] } };
}

const commands = [
  command('acces', 'Gérer les rôles autorisés à utiliser les commandes')
    .addStringOption((option) => choice(option.setName('action').setDescription('Action').setRequired(true), [['Ajouter', 'add'], ['Retirer', 'remove'], ['Liste', 'list']]))
    .addStringOption((option) => option.setName('commande').setDescription('Nom de la commande concernée').setRequired(false).setMaxLength(32))
    .addRoleOption((option) => option.setName('role').setDescription('Rôle à ajouter ou retirer').setRequired(false)),
  command('automod', 'Configurer les filtres automatiques')
    .addStringOption((option) => choice(option.setName('action').setDescription('Action').setRequired(true), [['État', 'status'], ['Activer', 'enable'], ['Désactiver', 'disable'], ['Bloquer un terme', 'block'], ['Autoriser un terme', 'unblock']]))
    .addStringOption((option) => option.setName('terme').setDescription('Mot ou expression (pour bloquer/autoriser)').setRequired(false).setMaxLength(80)),
  command('config', 'Voir la configuration générale du bot'),
  command('logs', 'Configurer le salon des journaux')
    .addStringOption((option) => choice(option.setName('action').setDescription('Action').setRequired(true), [['Configurer', 'set'], ['Désactiver', 'disable']]))
    .addChannelOption((option) => option.setName('salon').setDescription('Salon de réception des logs').addChannelTypes(...textChannelTypes).setRequired(false)),
  command('owner', 'Gérer les owners du bot sur ce serveur')
    .addStringOption((option) => choice(option.setName('action').setDescription('Action').setRequired(true), [['Ajouter', 'add'], ['Liste', 'list'], ['Retirer', 'remove']]))
    .addUserOption((option) => option.setName('membre').setDescription('Membre à ajouter ou retirer').setRequired(false)),
  command('serveurs', 'Afficher les serveurs où le bot est présent'),
  command('cinvite', 'Supprimer une invitation du serveur')
    .addStringOption((option) => option.setName('code').setDescription('Code de l’invitation à supprimer').setRequired(true)),
  command('compteur', 'Configurer le salon compteur de membres')
    .addSubcommand((sub) => sub.setName('configurer').setDescription('Définir le salon compteur').addChannelOption((option) => option.setName('salon').setDescription('Salon vocal à renommer avec le compteur').addChannelTypes(ChannelType.GuildVoice).setRequired(true)))
    .addSubcommand((sub) => sub.setName('desactiver').setDescription('Désactiver le compteur')),
  command('dero', 'Gérer les rôles exemptés de l’automodération')
    .addStringOption((option) => choice(option.setName('action').setDescription('Action').setRequired(true), [['Ajouter', 'add'], ['Retirer', 'remove'], ['Liste', 'list']]))
    .addRoleOption((option) => option.setName('role').setDescription('Rôle dérogatoire').setRequired(false)),
  command('embed', 'Envoyer un message Components V2 personnalisé')
    .addStringOption((option) => option.setName('texte').setDescription('Contenu du message').setRequired(true).setMaxLength(3500))
    .addStringOption((option) => option.setName('titre').setDescription('Titre facultatif').setRequired(false).setMaxLength(200))
    .addStringOption((option) => option.setName('image').setDescription('URL HTTPS d’image facultative').setRequired(false).setMaxLength(500))
    .addChannelOption((option) => option.setName('salon').setDescription('Salon de destination').addChannelTypes(...textChannelTypes).setRequired(false)),
  command('everyone', 'Envoyer une annonce à un rôle opt-in (maximum 10 membres)')
    .addRoleOption((option) => option.setName('role').setDescription('Rôle volontairement ciblé').setRequired(true))
    .addStringOption((option) => option.setName('message').setDescription('Texte de l’annonce').setRequired(true).setMaxLength(1500)),
  command('ghostping', 'Consulter les mentions supprimées détectées')
    .addStringOption((option) => choice(option.setName('action').setDescription('Action').setRequired(true), [['Consulter', 'list'], ['Effacer', 'clear']])),
  command('leaderboard', 'Configurer ou consulter le classement vocal et messages')
    .addSubcommand((sub) => sub.setName('configurer').setDescription('Configurer un classement').addStringOption((option) => choice(option.setName('type').setDescription('Classement').setRequired(true), [['Messages', 'messages'], ['Vocal', 'voice']])).addChannelOption((option) => option.setName('salon').setDescription('Salon du classement').addChannelTypes(...textChannelTypes).setRequired(true)))
    .addSubcommand((sub) => sub.setName('consulter').setDescription('Consulter un classement').addStringOption((option) => choice(option.setName('type').setDescription('Classement').setRequired(true), [['Messages', 'messages'], ['Vocal', 'voice']])))
    .addSubcommand((sub) => sub.setName('desactiver').setDescription('Désactiver un classement').addStringOption((option) => choice(option.setName('type').setDescription('Classement').setRequired(true), [['Messages', 'messages'], ['Vocal', 'voice']]))),
  command('menu', 'Créer un menu de rôles')
    .addSubcommand((sub) => sub.setName('ajouter').setDescription('Ajouter un choix au menu').addRoleOption((o) => o.setName('role').setDescription('Rôle attribué').setRequired(true)).addStringOption((o) => o.setName('nom').setDescription('Nom affiché').setRequired(true).setMaxLength(80)))
    .addSubcommand((sub) => sub.setName('retirer').setDescription('Retirer un choix').addRoleOption((o) => o.setName('role').setDescription('Rôle à retirer').setRequired(true)))
    .addSubcommand((sub) => sub.setName('liste').setDescription('Afficher les choix configurés'))
    .addSubcommand((sub) => sub.setName('publier').setDescription('Publier le menu de rôles').addChannelOption((o) => o.setName('salon').setDescription('Salon de publication').addChannelTypes(...textChannelTypes).setRequired(false))),
  command('report', 'Envoyer ou gérer des signalements')
    .addSubcommand((sub) => sub.setName('envoyer').setDescription('Signaler un membre au staff').addUserOption((o) => o.setName('membre').setDescription('Membre signalé').setRequired(true)).addStringOption((o) => o.setName('raison').setDescription('Raison du signalement').setRequired(true).setMaxLength(1000)))
    .addSubcommand((sub) => sub.setName('liste').setDescription('Consulter les signalements'))
    .addSubcommand((sub) => sub.setName('supprimer').setDescription('Supprimer un signalement').addIntegerOption((o) => o.setName('numero').setDescription('Numéro affiché dans la liste').setRequired(true).setMinValue(1))),
  command('soutien', 'Configurer un rôle de soutien')
    .addSubcommand((sub) => sub.setName('config').setDescription('Définir le rôle soutien').addRoleOption((o) => o.setName('role').setDescription('Rôle de soutien').setRequired(true)))
    .addSubcommand((sub) => sub.setName('desactiver').setDescription('Désactiver le rôle soutien')),
  command('sync', 'Copier les permissions d’un salon vers un autre')
    .addChannelOption((option) => option.setName('source').setDescription('Salon source').setRequired(true))
    .addChannelOption((option) => option.setName('destination').setDescription('Salon de destination').setRequired(true)),
  command('welcome', 'Configurer le message d’arrivée')
    .addSubcommand((sub) => sub.setName('config').setDescription('Configurer le message d’accueil').addChannelOption((o) => o.setName('salon').setDescription('Salon d’accueil').addChannelTypes(...textChannelTypes).setRequired(true)).addStringOption((o) => o.setName('message').setDescription('Variables disponibles : {user}, {server}, {count}').setRequired(true).setMaxLength(1500)))
    .addSubcommand((sub) => sub.setName('desactiver').setDescription('Désactiver le message d’accueil')),
  command('config-invite', 'Configurer les journaux d’invitations')
    .addStringOption((option) => choice(option.setName('action').setDescription('Action').setRequired(true), [['Configurer', 'set'], ['Désactiver', 'disable']]))
    .addChannelOption((option) => option.setName('salon').setDescription('Salon de journalisation').addChannelTypes(...textChannelTypes).setRequired(false)),
  command('invite', 'Voir les invitations attribuées à un membre')
    .addUserOption((option) => option.setName('membre').setDescription('Membre (par défaut : toi)').setRequired(false)),
  command('lb-invite', 'Afficher le classement des invitations'),
  command('reset-invite', 'Remettre à zéro les invitations comptabilisées')
    .addUserOption((option) => option.setName('membre').setDescription('Membre ciblé (facultatif : tout le serveur)').setRequired(false)),
  command('check', 'Afficher le statut vocal et le mute d’un membre')
    .addUserOption((option) => option.setName('membre').setDescription('Membre (par défaut : toi)').setRequired(false)),
  command('giveaway', 'Créer ou terminer un giveaway')
    .addSubcommand((sub) => sub.setName('lancer').setDescription('Lancer un giveaway').addStringOption((o) => o.setName('prix').setDescription('Prix à gagner').setRequired(true).setMaxLength(200)).addIntegerOption((o) => o.setName('minutes').setDescription('Durée en minutes').setRequired(true).setMinValue(1).setMaxValue(10080)).addIntegerOption((o) => o.setName('gagnants').setDescription('Nombre de gagnants').setRequired(true).setMinValue(1).setMaxValue(20)))
    .addSubcommand((sub) => sub.setName('terminer').setDescription('Terminer un giveaway').addStringOption((o) => o.setName('message_id').setDescription('ID du message giveaway').setRequired(true))),
];

function updateGuild(guildId, change) {
  return updateConfig(guildId, (config) => change(config));
}

function messagePayload(content, image) {
  if (!image) return v2(content);
  const container = new ContainerBuilder()
    .setAccentColor(0x808080)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(content))
    .addMediaGalleryComponents(new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(image)));
  return { flags: MessageFlags.IsComponentsV2, components: [container], allowedMentions: { parse: [] } };
}

function isManager(interaction) {
  return interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)
    || interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);
}

function isOwner(interaction, config) {
  return interaction.guild.ownerId === interaction.user.id || (config.ownerIds || []).includes(interaction.user.id);
}

function requireManager(interaction) {
  return commandAccess(interaction);
}

function commandAccess(interaction) {
  const config = getConfig(interaction.guildId);
  if (isOwner(interaction, config) || isManager(interaction)) return true;
  const roles = config.accessRoleIds?.[interaction.commandName] || [];
  return roles.length > 0 && roles.some((roleId) => interaction.member.roles.cache.has(roleId));
}

function cap(value, max) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function updateCounter(guild) {
  const { counterChannelId } = getConfig(guild.id);
  if (!counterChannelId) return Promise.resolve();
  return guild.channels.fetch(counterChannelId).then((channel) => (
    channel?.setName(`membres-${guild.memberCount}`).catch((error) => {
      console.error(`Impossible de renommer le compteur ${channel.id}:`, error);
    })
  ));
}

function metricsWithActiveVoice(guildId, savedMetrics) {
  const metrics = { ...savedMetrics };
  for (const [key, startedAt] of voiceSessions) {
    const [activeGuildId, userId] = key.split(':');
    if (activeGuildId !== guildId) continue;
    metrics[userId] = { ...(metrics[userId] || { messages: 0, voice: 0 }) };
    metrics[userId].voice += Math.floor((Date.now() - startedAt) / 60_000);
  }
  return metrics;
}

function leaderboardText(config, type, guildId) {
  const metrics = type === 'voice'
    ? metricsWithActiveVoice(guildId, config.metrics || {})
    : config.metrics || {};
  const entries = Object.entries(metrics)
    .sort((a, b) => (b[1][type] || 0) - (a[1][type] || 0))
    .slice(0, 10);
  const values = entries.map(([id, value], index) => (
    `${index + 1}. <@${id}> — ${type === 'voice' ? `${value.voice || 0} min` : `${value.messages || 0} messages`}`
  ));
  return `## Top ${type === 'voice' ? 'vocal' : 'messages'}\n${values.join('\n') || 'Aucune statistique enregistrée.'}`;
}

async function refreshLeaderboard(client, guildId, type) {
  const config = getConfig(guildId);
  const channelId = config.leaderboards?.[type];
  if (!channelId) return;
  const guild = await client.guilds.fetch(guildId);
  const channel = await guild.channels.fetch(channelId);
  if (!channel?.isTextBased()) throw new Error(`Le salon du classement ${type} n’est plus un salon texte.`);
  const messageId = config.leaderboardMessageIds?.[type];
  if (messageId) {
    try {
      const message = await channel.messages.fetch(messageId);
      await message.edit(v2(leaderboardText(config, type, guildId)));
      return;
    } catch (error) {
      if (error.code !== 10008) throw error;
    }
  }
  const message = await channel.send(v2(leaderboardText(config, type, guildId)));
  updateGuild(guildId, (current) => {
    current.leaderboardMessageIds ||= {};
    current.leaderboardMessageIds[type] = message.id;
    return current;
  });
}

async function execute(interaction) {
  const guildId = interaction.guildId;
  const guild = interaction.guild;
  const config = getConfig(guildId);
  const name = interaction.commandName;
  const sub = interaction.options.getSubcommand(false);
  const role = interaction.options.getRole('role');
  const user = interaction.options.getUser('membre');

  if (!commandAccess(interaction) && !['invite', 'lb-invite', 'check'].includes(name)) {
    return interaction.reply(v2('Tu n’as pas accès à cette commande. Demande à un administrateur de configurer `/acces`.', [], true));
  }

  if (name === 'acces') {
    if (!requireManager(interaction)) return interaction.reply(v2('Permission **Gérer le serveur** requise.', [], true));
    const action = interaction.options.getString('action', true);
    const target = interaction.options.getString('commande');
    if (action !== 'list' && (!target || !role)) return interaction.reply(v2('Indique `commande` et `role` pour ajouter ou retirer un accès.', [], true));
    updateGuild(guildId, (current) => {
      current.accessRoleIds ||= {};
      if (action === 'add') current.accessRoleIds[target] = [...new Set([...(current.accessRoleIds[target] || []), role.id])];
      if (action === 'remove') current.accessRoleIds[target] = (current.accessRoleIds[target] || []).filter((id) => id !== role.id);
      return current;
    });
    const fresh = getConfig(guildId);
    const rows = Object.entries(fresh.accessRoleIds || {}).filter(([, ids]) => ids.length).map(([key, ids]) => `**/${key}** — ${ids.map((id) => `<@&${id}>`).join(', ')}`);
    return interaction.reply(v2(action === 'list' ? `## Accès configurés\n${rows.join('\n') || 'Aucun rôle configuré.'}` : `Accès mis à jour pour **/${target}**.`, [], true));
  }

  if (name === 'automod') {
    if (!requireManager(interaction)) return interaction.reply(v2('Permission **Gérer le serveur** requise.', [], true));
    const action = interaction.options.getString('action', true);
    const term = interaction.options.getString('terme')?.trim().toLowerCase();
    if (['block', 'unblock'].includes(action) && !term) return interaction.reply(v2('Indique le terme à bloquer ou autoriser.', [], true));
    updateGuild(guildId, (current) => {
      current.automod ||= { enabled: false, blockedTerms: [] };
      if (action === 'enable') current.automod.enabled = true;
      if (action === 'disable') current.automod.enabled = false;
      if (action === 'block' && !current.automod.blockedTerms.includes(term)) current.automod.blockedTerms.push(term);
      if (action === 'unblock') current.automod.blockedTerms = current.automod.blockedTerms.filter((item) => item !== term);
      return current;
    });
    const state = getConfig(guildId).automod || { enabled: false, blockedTerms: [] };
    return interaction.reply(v2(`Automod **${state.enabled ? 'activé' : 'désactivé'}**.\nTermes bloqués : ${state.blockedTerms.join(', ') || 'aucun'}`, [], true));
  }

  if (name === 'config') {
    const state = [
      `## Configuration — ${guild.name}`,
      `**Owners :** ${(config.ownerIds || []).map((id) => `<@${id}>`).join(', ') || 'aucun'}`,
      `**Logs :** ${config.logChannelId ? `<#${config.logChannelId}>` : 'non configurés'}`,
      `**Accueil :** ${config.welcome?.channelId ? `<#${config.welcome.channelId}>` : 'désactivé'}`,
      `**Compteur :** ${config.counterChannelId ? `<#${config.counterChannelId}>` : 'désactivé'}`,
      `**Automod :** ${config.automod?.enabled ? 'activé' : 'désactivé'}`,
    ].join('\n\n');
    return interaction.reply(v2(state, [], true));
  }

  if (name === 'logs') {
    if (!requireManager(interaction)) return interaction.reply(v2('Permission **Gérer le serveur** requise.', [], true));
    const action = interaction.options.getString('action', true);
    if (action === 'disable') updateGuild(guildId, (current) => ({ ...current, logChannelId: null }));
    else {
      const channel = interaction.options.getChannel('salon');
      if (!channel) return interaction.reply(v2('Indique un salon texte.', [], true));
      updateGuild(guildId, (current) => ({ ...current, logChannelId: channel.id }));
    }
    return interaction.reply(v2(action === 'disable' ? 'Journaux désactivés.' : `Journaux configurés dans ${interaction.options.getChannel('salon')}.`, [], true));
  }

  if (name === 'owner') {
    if (!isOwner(interaction, config)) return interaction.reply(v2('Seul le propriétaire du serveur ou un owner configuré peut gérer cette liste.', [], true));
    const action = interaction.options.getString('action', true);
    if (action !== 'list' && !user) return interaction.reply(v2('Indique un membre.', [], true));
    updateGuild(guildId, (current) => {
      current.ownerIds ||= [];
      if (action === 'add' && !current.ownerIds.includes(user.id)) current.ownerIds.push(user.id);
      if (action === 'remove') current.ownerIds = current.ownerIds.filter((id) => id !== user.id);
      return current;
    });
    return interaction.reply(v2(action === 'list' ? `Owners : ${(config.ownerIds || []).map((id) => `<@${id}>`).join(', ') || 'aucun'}` : `Liste des owners mise à jour pour ${user}.`, [], true));
  }

  if (name === 'serveurs') {
    if (!isOwner(interaction, config)) return interaction.reply(v2('Commande réservée aux owners du bot sur ce serveur.', [], true));
    const guilds = [...interaction.client.guilds.cache.values()].slice(0, 100);
    return interaction.reply(v2(`## Serveurs (${interaction.client.guilds.cache.size})\n${guilds.map((item) => `• **${item.name}** — \`${item.id}\` (${item.memberCount} membres)`).join('\n') || 'Aucun serveur.'}`, [], true));
  }

  if (name === 'cinvite') {
    if (!requireManager(interaction)) return interaction.reply(v2('Permission **Gérer le serveur** requise.', [], true));
    const invite = await guild.invites.fetch(interaction.options.getString('code', true));
    if (!invite) return interaction.reply(v2('Invitation introuvable.', [], true));
    await invite.delete(`Invitation supprimée par ${interaction.user.tag}`);
    return interaction.reply(v2('Invitation supprimée.', [], true));
  }

  if (name === 'compteur') {
    if (!requireManager(interaction)) return interaction.reply(v2('Permission **Gérer le serveur** requise.', [], true));
    if (sub === 'desactiver') updateGuild(guildId, (current) => ({ ...current, counterChannelId: null }));
    else {
      const channel = interaction.options.getChannel('salon');
      if (!channel) return interaction.reply(v2('Indique un salon vocal.', [], true));
      updateGuild(guildId, (current) => ({ ...current, counterChannelId: channel.id }));
      await channel.setName(`membres-${guild.memberCount}`);
    }
    return interaction.reply(v2(sub === 'desactiver' ? 'Compteur désactivé.' : 'Compteur configuré.', [], true));
  }

  if (name === 'dero') {
    if (!requireManager(interaction)) return interaction.reply(v2('Permission **Gérer le serveur** requise.', [], true));
    const action = interaction.options.getString('action', true);
    if (action !== 'list' && !role) return interaction.reply(v2('Indique le rôle à ajouter ou retirer.', [], true));
    updateGuild(guildId, (current) => {
      current.exemptRoleIds ||= [];
      if (action === 'add') current.exemptRoleIds = [...new Set([...current.exemptRoleIds, role.id])];
      if (action === 'remove') current.exemptRoleIds = current.exemptRoleIds.filter((id) => id !== role.id);
      return current;
    });
    const ids = getConfig(guildId).exemptRoleIds || [];
    return interaction.reply(v2(action === 'list' ? `Rôles dérogatoires : ${ids.map((id) => `<@&${id}>`).join(', ') || 'aucun'}` : 'Dérogations mises à jour.', [], true));
  }

  if (name === 'embed') {
    if (!requireManager(interaction)) return interaction.reply(v2('Permission **Gérer le serveur** requise.', [], true));
    const text = interaction.options.getString('texte', true);
    const title = interaction.options.getString('titre');
    const image = interaction.options.getString('image');
    const channel = interaction.options.getChannel('salon') || interaction.channel;
    if (image && (!/^https:\/\//i.test(image) || !/\.(png|jpe?g|gif|webp)(?:\?.*)?$/i.test(image))) return interaction.reply(v2('L’image doit être une URL HTTPS directe vers un fichier image.', [], true));
    const content = [title ? `## ${title}` : '', text].filter(Boolean).join('\n\n');
    await channel.send(messagePayload(content, image));
    return interaction.reply(v2(`Message envoyé dans ${channel}.`, [], true));
  }

  if (name === 'everyone') {
    if (!requireManager(interaction)) return interaction.reply(v2('Permission **Gérer le serveur** requise.', [], true));
    const targetRole = role;
    if (targetRole.id === guild.roles.everyone.id || targetRole.members.size > 10) return interaction.reply(v2('Choisis un rôle opt-in contenant au maximum 10 membres. Les mentions @everyone ne sont pas autorisées.', [], true));
    const mentions = [...targetRole.members.values()].map((member) => `<@${member.id}>`).join(' ');
    await interaction.channel.send({
      ...v2(`${mentions}\n\n${interaction.options.getString('message', true)}`),
      allowedMentions: { users: [...targetRole.members.keys()] },
    });
    return interaction.reply(v2(`Annonce envoyée à ${targetRole.members.size} membres du rôle.`, [], true));
  }

  if (name === 'ghostping') {
    const action = interaction.options.getString('action', true);
    if (action === 'clear') {
      if (!requireManager(interaction)) return interaction.reply(v2('Permission **Gérer le serveur** requise.', [], true));
      updateGuild(guildId, (current) => ({ ...current, ghostPings: [] }));
      return interaction.reply(v2('Historique des ghostpings effacé.', [], true));
    }
    const entries = config.ghostPings || [];
    return interaction.reply(v2(`## Ghostpings détectés\n${entries.slice(-15).reverse().map((entry) => `• <@${entry.authorId}> dans <#${entry.channelId}> — ${entry.content}`).join('\n') || 'Aucun ghostping détecté.'}`, [], true));
  }

  if (name === 'leaderboard') {
    const type = interaction.options.getString('type');
    if (sub === 'configurer') {
      if (!requireManager(interaction)) return interaction.reply(v2('Permission **Gérer le serveur** requise.', [], true));
      const channel = interaction.options.getChannel('salon');
      if (!channel || !type) return interaction.reply(v2('Indique un type et un salon.', [], true));
      updateGuild(guildId, (current) => {
        current.leaderboards ||= {};
        current.leaderboards[type] = channel.id;
        return current;
      });
      await refreshLeaderboard(interaction.client, guildId, type);
      return interaction.reply(v2(`Classement **${type}** configuré dans ${channel}.`, [], true));
    }
    if (sub === 'desactiver') {
      if (!requireManager(interaction)) return interaction.reply(v2('Permission **Gérer le serveur** requise.', [], true));
      if (!type) return interaction.reply(v2('Indique le type à désactiver.', [], true));
      updateGuild(guildId, (current) => {
        delete current.leaderboards?.[type];
        return current;
      });
      return interaction.reply(v2(`Classement ${type} désactivé.`, [], true));
    }
    const metrics = type === 'voice'
      ? metricsWithActiveVoice(guildId, config.metrics || {})
      : config.metrics || {};
    const entries = Object.entries(metrics).sort((a, b) => (b[1][type] || 0) - (a[1][type] || 0)).slice(0, 10);
    return interaction.reply(v2(`## Top ${type || 'membres'}\n${entries.map(([id, value], index) => `${index + 1}. <@${id}> — ${type === 'voice' ? `${value.voice || 0} min` : `${value.messages || 0} messages`}`).join('\n') || 'Aucune statistique enregistrée.'}`, [], true));
  }

  if (name === 'menu') {
    const action = sub;
    if (action === 'ajouter' || action === 'retirer' || action === 'publier') {
      if (!requireManager(interaction)) return interaction.reply(v2('Permission **Gérer le serveur** requise.', [], true));
    }
    if (action === 'ajouter') {
      if (role.id === guild.roles.everyone.id || !role.editable || role.managed) {
        return interaction.reply(v2('Ce rôle ne peut pas être distribué par le bot. Vérifie sa position et ses permissions.', [], true));
      }
      const label = interaction.options.getString('nom', true);
      updateGuild(guildId, (current) => {
        current.roleMenu ||= [];
        if (current.roleMenu.length >= 25) throw new Error('Un menu Discord ne peut pas contenir plus de 25 rôles.');
        if (current.roleMenu.some((item) => item.roleId === role.id)) throw new Error('Ce rôle est déjà dans le menu.');
        current.roleMenu.push({ roleId: role.id, label });
        return current;
      });
      return interaction.reply(v2(`Choix **${label}** ajouté au menu.`, [], true));
    }
    if (action === 'retirer') {
      updateGuild(guildId, (current) => ({ ...current, roleMenu: (current.roleMenu || []).filter((item) => item.roleId !== role.id) }));
      return interaction.reply(v2('Choix retiré.', [], true));
    }
    if (action === 'liste') return interaction.reply(v2(`## Rôles du menu\n${(config.roleMenu || []).map((item) => `• ${item.label} — <@&${item.roleId}>`).join('\n') || 'Aucun choix configuré.'}`, [], true));
    if (action === 'publier') {
      const items = (config.roleMenu || []).filter((item) => guild.roles.cache.has(item.roleId));
      if (!items.length) return interaction.reply(v2('Ajoute des rôles au menu avant de le publier.', [], true));
      const channel = interaction.options.getChannel('salon') || interaction.channel;
      const menu = new StringSelectMenuBuilder().setCustomId('roles:select').setPlaceholder('Choisir un rôle').setMinValues(0).setMaxValues(items.length).addOptions(items.map((item) => ({ label: cap(item.label, 100), value: item.roleId })));
      await channel.send(v2('## Choisis tes rôles\nSélectionne les rôles que tu souhaites recevoir.', [new ActionRowBuilder().addComponents(menu)]));
      return interaction.reply(v2(`Menu publié dans ${channel}.`, [], true));
    }
  }

  if (name === 'report') {
    if (sub === 'envoyer') {
      const target = user;
      const reason = interaction.options.getString('raison', true);
      updateGuild(guildId, (current) => {
        current.reports ||= [];
        current.reports.push({ authorId: interaction.user.id, targetId: target.id, reason, createdAt: Date.now() });
        return current;
      });
      const report = config.logChannelId ? await guild.channels.fetch(config.logChannelId) : null;
      if (report?.isTextBased()) await report.send(v2(`## Nouveau signalement\n**Auteur :** ${interaction.user}\n**Membre :** ${target}\n**Raison :** ${reason}`));
      return interaction.reply(v2('Signalement transmis au staff.', [], true));
    }
    if (!requireManager(interaction)) return interaction.reply(v2('Permission **Gérer le serveur** requise.', [], true));
    if (sub === 'supprimer') {
      const index = interaction.options.getInteger('numero', true) - 1;
      if (!config.reports?.[index]) return interaction.reply(v2('Numéro de signalement invalide.', [], true));
      updateGuild(guildId, (current) => ({ ...current, reports: current.reports.filter((_, i) => i !== index) }));
      return interaction.reply(v2('Signalement supprimé.', [], true));
    }
    return interaction.reply(v2(`## Signalements\n${(config.reports || []).slice(0, 15).map((item, index) => `${index + 1}. <@${item.targetId}> par <@${item.authorId}> — ${item.reason}`).join('\n') || 'Aucun signalement.'}`, [], true));
  }

  if (name === 'soutien') {
    if (!requireManager(interaction)) return interaction.reply(v2('Permission **Gérer le serveur** requise.', [], true));
    if (sub === 'desactiver') updateGuild(guildId, (current) => ({ ...current, supportRoleId: null }));
    else updateGuild(guildId, (current) => ({ ...current, supportRoleId: role.id }));
    return interaction.reply(v2(sub === 'desactiver' ? 'Rôle soutien désactivé.' : `Rôle soutien configuré : ${role}.`, [], true));
  }

  if (name === 'sync') {
    if (!requireManager(interaction)) return interaction.reply(v2('Permission **Gérer le serveur** requise.', [], true));
    const source = interaction.options.getChannel('source', true);
    const destination = interaction.options.getChannel('destination', true);
    if (!source.permissionOverwrites || !destination.permissionOverwrites) return interaction.reply(v2('Les deux salons doivent prendre en charge les permissions.', [], true));
    await destination.permissionOverwrites.set(source.permissionOverwrites.cache, `Synchronisation demandée par ${interaction.user.tag}`);
    return interaction.reply(v2(`Permissions synchronisées de ${source} vers ${destination}.`, [], true));
  }

  if (name === 'welcome') {
    if (!requireManager(interaction)) return interaction.reply(v2('Permission **Gérer le serveur** requise.', [], true));
    if (sub === 'desactiver') updateGuild(guildId, (current) => ({ ...current, welcome: null }));
    else {
      const channel = interaction.options.getChannel('salon', true);
      const message = interaction.options.getString('message', true);
      updateGuild(guildId, (current) => ({ ...current, welcome: { channelId: channel.id, message } }));
    }
    return interaction.reply(v2(sub === 'desactiver' ? 'Message d’accueil désactivé.' : 'Message d’accueil configuré.', [], true));
  }

  if (name === 'config-invite') {
    if (!requireManager(interaction)) return interaction.reply(v2('Permission **Gérer le serveur** requise.', [], true));
    const action = interaction.options.getString('action', true);
    if (action === 'disable') updateGuild(guildId, (current) => ({ ...current, inviteLogChannelId: null }));
    else {
      const channel = interaction.options.getChannel('salon');
      if (!channel) return interaction.reply(v2('Indique un salon texte.', [], true));
      updateGuild(guildId, (current) => ({ ...current, inviteLogChannelId: channel.id }));
    }
    return interaction.reply(v2(action === 'disable' ? 'Logs d’invitations désactivés.' : `Logs d’invitations configurés dans ${interaction.options.getChannel('salon')}.`, [], true));
  }

  if (name === 'invite' || name === 'lb-invite') {
    const counters = config.invites || {};
    if (name === 'invite') {
      const target = user || interaction.user;
      const count = counters[target.id] || { joins: 0, leaves: 0 };
      return interaction.reply(v2(`## Invitations de ${target.tag}\nUtilisées : **${count.joins}**\nDéparts : **${count.leaves}**\nInvitations nettes : **${count.joins - count.leaves}**`, [], true));
    }
    const entries = Object.entries(counters).sort((a, b) => (b[1].joins - b[1].leaves) - (a[1].joins - a[1].leaves)).slice(0, 10);
    return interaction.reply(v2(`## Classement des invitations\n${entries.map(([id, count], index) => `${index + 1}. <@${id}> — ${count.joins - count.leaves} nettes`).join('\n') || 'Aucune invitation suivie.'}`, [], true));
  }

  if (name === 'reset-invite') {
    if (!requireManager(interaction)) return interaction.reply(v2('Permission **Gérer le serveur** requise.', [], true));
    if (user) updateGuild(guildId, (current) => {
      current.invites ||= {};
      delete current.invites[user.id];
      return current;
    });
    else updateGuild(guildId, (current) => ({ ...current, invites: {} }));
    return interaction.reply(v2(user ? `Compteur réinitialisé pour ${user}.` : 'Tous les compteurs ont été réinitialisés.', [], true));
  }

  if (name === 'check') {
    const target = interaction.options.getMember('membre') || interaction.member;
    if (!target) return interaction.reply(v2('Membre introuvable.', [], true));
    const voice = target.voice.channel ? `Connecté à ${target.voice.channel}` : 'Non connecté en vocal';
    const timeout = target.communicationDisabledUntilTimestamp;
    const mute = timeout && timeout > Date.now() ? `Timeout jusqu’au <t:${Math.floor(timeout / 1000)}:F>` : 'Pas de timeout';
    return interaction.reply(v2(`## Statut de ${target.user.tag}\n**Vocal :** ${voice}\n**Mute serveur :** ${mute}`, [], true));
  }

  if (name === 'giveaway') {
    if (!requireManager(interaction)) return interaction.reply(v2('Permission **Gérer le serveur** requise.', [], true));
    if (sub === 'lancer') {
      const prize = interaction.options.getString('prix', true);
      const minutes = interaction.options.getInteger('minutes', true);
      const winners = interaction.options.getInteger('gagnants', true);
      const endsAt = Date.now() + minutes * 60_000;
      const button = new ButtonBuilder().setCustomId('giveaway:join').setLabel('Participer').setStyle(ButtonStyle.Secondary);
      const message = await interaction.channel.send(v2(`## Giveaway : ${prize}\nClique pour participer.\nFin <t:${Math.floor(endsAt / 1000)}:R> — ${winners} gagnant(s).`, [new ActionRowBuilder().addComponents(button)]));
      updateGuild(guildId, (current) => {
        current.giveaways ||= {};
        current.giveaways[message.id] = { prize, channelId: message.channelId, endsAt, winners, participants: [], ended: false };
        return current;
      });
      scheduleGiveaway(interaction.client, guildId, message.id, endsAt);
      return interaction.reply(v2(`Giveaway lancé : ${message.url}`, [], true));
    }
    return endGiveaway(interaction, interaction.options.getString('message_id', true));
  }

  return false;
}

async function endGiveaway(interaction, messageId) {
  const winners = await finishGiveaway(interaction.client, interaction.guildId, messageId);
  if (!winners) return interaction.reply(v2('Giveaway introuvable ou déjà terminé.', [], true));
  return interaction.reply(v2(winners.length ? `Gagnant(s) : ${winners.map((id) => `<@${id}>`).join(', ')}` : 'Aucun participant au giveaway.', [], true));
}

function scheduleGiveaway(client, guildId, messageId, endsAt) {
  const key = `${guildId}:${messageId}`;
  const previous = giveawayTimers.get(key);
  if (previous) clearTimeout(previous);
  const timer = setTimeout(() => {
    giveawayTimers.delete(key);
    finishGiveaway(client, guildId, messageId).catch((error) => {
      console.error(`Impossible de terminer le giveaway ${messageId}:`, error);
    });
  }, Math.max(0, endsAt - Date.now()));
  giveawayTimers.set(key, timer);
}

async function finishGiveaway(client, guildId, messageId) {
  const key = `${guildId}:${messageId}`;
  if (finishingGiveaways.has(key)) return null;
  finishingGiveaways.add(key);
  try {
    const config = getConfig(guildId);
    const giveaway = config.giveaways?.[messageId];
    if (!giveaway || giveaway.ended) return null;
    const participants = [...giveaway.participants];
    const winners = [];
    while (participants.length && winners.length < giveaway.winners) {
      winners.push(participants.splice(Math.floor(Math.random() * participants.length), 1)[0]);
    }
    const guild = await client.guilds.fetch(guildId);
    const channel = await guild.channels.fetch(giveaway.channelId);
    const message = await channel.messages.fetch(messageId);
    await message.edit(v2(`## Giveaway terminé : ${giveaway.prize}\n${winners.length ? winners.map((id) => `<@${id}>`).join(', ') : 'Aucun participant.'}`));
    updateGuild(guildId, (current) => {
      current.giveaways[messageId].ended = true;
      current.giveaways[messageId].winnerIds = winners;
      return current;
    });
    const timer = giveawayTimers.get(key);
    if (timer) clearTimeout(timer);
    giveawayTimers.delete(key);
    return winners;
  } finally {
    finishingGiveaways.delete(key);
  }
}

async function handleComponent(interaction) {
  if (interaction.customId === 'roles:select') {
    const config = getConfig(interaction.guildId);
    const allowed = new Set((config.roleMenu || []).map((item) => item.roleId));
    const member = interaction.member;
    const selected = new Set(interaction.values);
    const additions = [...selected].filter((id) => allowed.has(id) && !member.roles.cache.has(id));
    const removals = [...allowed].filter((id) => member.roles.cache.has(id) && !selected.has(id));
    await member.roles.add(additions);
    await member.roles.remove(removals);
    return interaction.reply(v2('Tes rôles ont été mis à jour.', [], true));
  }
  if (interaction.customId === 'giveaway:join') {
    const config = getConfig(interaction.guildId);
    const giveaway = config.giveaways?.[interaction.message.id];
    if (!giveaway || giveaway.ended || giveaway.endsAt <= Date.now()) return interaction.reply(v2('Ce giveaway est terminé.', [], true));
    const joined = giveaway.participants.includes(interaction.user.id);
    updateGuild(interaction.guildId, (current) => {
      const participants = current.giveaways[interaction.message.id].participants;
      current.giveaways[interaction.message.id].participants = joined
        ? participants.filter((id) => id !== interaction.user.id)
        : [...participants, interaction.user.id];
      return current;
    });
    return interaction.reply(v2(joined ? 'Tu as quitté le giveaway.' : 'Ta participation est enregistrée.', [], true));
  }
  return false;
}

async function onMessage(message) {
  if (!message.guild || message.author.bot) return;
  const config = getConfig(message.guild.id);
  const member = message.member;
  const exempt = (config.exemptRoleIds || []).some((id) => member?.roles.cache.has(id));
  if (config.automod?.enabled && !exempt) {
    const lower = message.content.toLowerCase();
    const blocked = (config.automod.blockedTerms || []).find((term) => lower.includes(term));
    if (blocked) {
      await message.delete().catch((error) => console.error('Suppression automod impossible:', error));
      if (config.logChannelId) {
        const channel = await message.guild.channels.fetch(config.logChannelId).catch((error) => {
          console.error('Salon de logs introuvable:', error);
          return null;
        });
        if (channel?.isTextBased()) await channel.send(v2(`Automod : message de ${message.author} supprimé dans <#${message.channelId}> (terme filtré).`));
      }
    }
  }
  updateGuild(message.guild.id, (current) => {
    current.metrics ||= {};
    current.metrics[message.author.id] ||= { messages: 0, voice: 0 };
    current.metrics[message.author.id].messages += 1;
    return current;
  });
}

async function onMessageDelete(message) {
  if (!message.guild || !message.author || message.author.bot) return;
  const config = getConfig(message.guild.id);
  const isGhostPing = Boolean(message.mentions?.users.size || message.mentions?.roles.size || message.mentions?.everyone);
  const content = cap(message.content || '[contenu non mis en cache]', 800);
  if (isGhostPing) {
    const entry = { authorId: message.author.id, channelId: message.channelId, content: cap(content, 250), createdAt: Date.now() };
    updateGuild(message.guild.id, (current) => {
      current.ghostPings ||= [];
      current.ghostPings.push(entry);
      current.ghostPings = current.ghostPings.slice(-50);
      return current;
    });
  }
  if (config.logChannelId) {
    const channel = await message.guild.channels.fetch(config.logChannelId).catch((error) => {
      console.error('Salon de logs introuvable:', error);
      return null;
    });
    if (channel?.isTextBased()) await channel.send(v2(`${isGhostPing ? 'Ghostping détecté' : 'Message supprimé'} : message de <@${message.author.id}> dans <#${message.channelId}>.\n${content}`));
  }
}

async function onMessageUpdate(oldMessage, newMessage) {
  if (!newMessage.guild || !newMessage.author || newMessage.author.bot || oldMessage.content === newMessage.content) return;
  const channelId = getConfig(newMessage.guild.id).logChannelId;
  if (!channelId) return;
  const channel = await newMessage.guild.channels.fetch(channelId).catch((error) => {
    console.error('Salon de logs introuvable:', error);
    return null;
  });
  if (!channel?.isTextBased()) return;
  await channel.send(v2(`Message modifié par <@${newMessage.author.id}> dans <#${newMessage.channelId}>.\n**Avant :** ${cap(oldMessage.content || '[contenu non mis en cache]', 700)}\n**Après :** ${cap(newMessage.content || '[contenu non mis en cache]', 700)}`));
}

async function onMemberAdd(member) {
  const inviterId = await attributeInvite(member);
  let config = getConfig(member.guild.id);
  if (config.welcome?.channelId) {
    const channel = await member.guild.channels.fetch(config.welcome.channelId).catch((error) => {
      console.error('Salon d’accueil introuvable:', error);
      return null;
    });
    if (channel?.isTextBased()) {
      const text = config.welcome.message
        .replaceAll('{user}', `<@${member.id}>`)
        .replaceAll('{server}', member.guild.name)
        .replaceAll('{count}', String(member.guild.memberCount));
      await channel.send({ ...v2(text), allowedMentions: { users: [member.id] } });
    }
  }
  await updateCounter(member.guild);
  if (inviterId) {
    updateGuild(member.guild.id, (current) => {
      current.invites ||= {};
      current.invites[inviterId] ||= { joins: 0, leaves: 0 };
      current.invites[inviterId].joins += 1;
      current.inviteCredits ||= {};
      current.inviteCredits[member.id] = inviterId;
      return current;
    });
    config = getConfig(member.guild.id);
  }
  if (config.inviteLogChannelId) {
    const channel = await member.guild.channels.fetch(config.inviteLogChannelId).catch((error) => {
      console.error('Salon d’invitations introuvable:', error);
      return null;
    });
    if (channel?.isTextBased()) await channel.send(v2(`${member.user.tag} a rejoint le serveur.${inviterId ? ` Invitation de <@${inviterId}>.` : ' Invitation utilisée non identifiée.'}`));
  }
}

async function onMemberRemove(member) {
  await updateCounter(member.guild);
  const inviterId = getConfig(member.guild.id).inviteCredits?.[member.id];
  if (inviterId) updateGuild(member.guild.id, (current) => {
    current.invites ||= {};
    current.invites[inviterId] ||= { joins: 0, leaves: 0 };
    current.invites[inviterId].leaves += 1;
    delete current.inviteCredits[member.id];
    return current;
  });
}

async function onVoiceStateUpdate(oldState, newState) {
  if (!oldState.guild || oldState.channelId === newState.channelId) return;
  const key = `${oldState.guild.id}:${oldState.id}`;
  if (oldState.channelId) {
    const startedAt = voiceSessions.get(key);
    voiceSessions.delete(key);
    if (startedAt) {
      const elapsed = Math.floor((Date.now() - startedAt) / 60_000);
      if (elapsed > 0) updateGuild(oldState.guild.id, (current) => {
        current.metrics ||= {};
        current.metrics[oldState.id] ||= { messages: 0, voice: 0 };
        current.metrics[oldState.id].voice += elapsed;
        return current;
      });
    }
  }
  if (newState.channelId) voiceSessions.set(key, Date.now());
}

async function attributeInvite(member) {
  try {
    const currentInvites = await member.guild.invites.fetch();
    const snapshots = getConfig(member.guild.id).inviteSnapshots || {};
    const used = currentInvites.find((invite) => invite.uses > (snapshots[invite.code] || 0));
    updateGuild(member.guild.id, (current) => {
      current.inviteSnapshots = Object.fromEntries(currentInvites.map((invite) => [invite.code, invite.uses || 0]));
      return current;
    });
    return used?.inviter?.id || null;
  } catch (error) {
    console.error(`Impossible d’identifier l’invitation utilisée sur ${member.guild.id}:`, error);
    return null;
  }
}

async function onInviteCreate(invite) {
  if (!invite.guild) return;
  updateGuild(invite.guild.id, (current) => {
    current.inviteSnapshots ||= {};
    current.inviteSnapshots[invite.code] = invite.uses || 0;
    return current;
  });
}

async function onInviteDelete(invite) {
  if (!invite.guild) return;
  updateGuild(invite.guild.id, (current) => {
    delete current.inviteSnapshots?.[invite.code];
    return current;
  });
}

async function onReady(client) {
  for (const guild of client.guilds.cache.values()) {
    for (const state of guild.voiceStates.cache.values()) {
      if (state.channelId && state.member && !state.member.user.bot) {
        voiceSessions.set(`${guild.id}:${state.id}`, Date.now());
      }
    }
    try {
      const invites = await guild.invites.fetch();
      updateGuild(guild.id, (current) => ({
        ...current,
        inviteSnapshots: Object.fromEntries(invites.map((invite) => [invite.code, invite.uses || 0])),
      }));
    } catch (error) {
      console.error(`Impossible d’initialiser le suivi des invitations sur ${guild.id}:`, error);
    }
    const { giveaways = {} } = getConfig(guild.id);
    for (const [messageId, giveaway] of Object.entries(giveaways)) {
      if (!giveaway.ended) scheduleGiveaway(client, guild.id, messageId, giveaway.endsAt);
    }
    if (!leaderboardTimers.has(guild.id)) {
      const timer = setInterval(() => {
        const { leaderboards = {} } = getConfig(guild.id);
        for (const type of Object.keys(leaderboards)) {
          refreshLeaderboard(client, guild.id, type).catch((error) => {
            console.error(`Impossible de mettre à jour le classement ${type} du serveur ${guild.id}:`, error);
          });
        }
      }, 60_000);
      leaderboardTimers.set(guild.id, timer);
    }
  }
}

module.exports = {
  commands,
  execute,
  handleComponent,
  commandAccess,
  onMessage,
  onMessageDelete,
  onMessageUpdate,
  onMemberAdd,
  onMemberRemove,
  onVoiceStateUpdate,
  onReady,
  onInviteCreate,
  onInviteDelete,
};
