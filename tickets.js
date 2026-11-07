const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
  ContainerBuilder,
  MessageFlags,
  ModalBuilder,
  PermissionFlagsBits,
  RoleSelectMenuBuilder,
  StringSelectMenuBuilder,
  TextDisplayBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');
const { getConfig, updateConfig } = require('./store');

const GREY = 0x808080;
const v2Flags = MessageFlags.IsComponentsV2;
const ephemeralFlags = v2Flags | MessageFlags.Ephemeral;

function makeContainer(text, rows = []) {
  const container = new ContainerBuilder()
    .setAccentColor(GREY)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(text));
  for (const row of rows) container.addActionRowComponents(row);
  return container;
}

function v2(content, rows = [], ephemeral = false) {
  return {
    flags: ephemeral ? ephemeralFlags : v2Flags,
    components: [makeContainer(content, rows)],
  };
}

function panelText(ticket) {
  const types = ticket.types.length
    ? ticket.types.map((type) => `• **${type.label}** — ${type.description}`).join('\n')
    : 'Aucun type configuré.';
  const content = [
    '## Configuration des tickets',
    `**Titre du panneau :** ${ticket.title}`,
    `**Description :** ${ticket.description}`,
    `**Message à l’ouverture :** ${ticket.openingMessage}`,
    `**Sélecteur :** ${ticket.useDropdown ? 'Menu déroulant' : 'Boutons'}`,
    `**Catégorie :** ${ticket.categoryId ? `<#${ticket.categoryId}>` : 'Non définie'}`,
    `**Salon du panneau :** ${ticket.panelChannelId ? `<#${ticket.panelChannelId}>` : 'À choisir à la publication'}`,
    `**Rôles support :** ${formatRoles(ticket.supportRoleIds)}`,
    `**Rôles avec accès :** ${formatRoles(ticket.accessRoleIds)}`,
    `**Rôles pingés :** ${formatRoles(ticket.pingRoleIds)}`,
    `**Types de tickets (${ticket.types.length}/25) :**\n${types}`,
    '-# Tous les panneaux et messages du bot utilisent un style gris Components V2.',
  ].join('\n\n');
  return content.length > 3900 ? `${content.slice(0, 3890)}…` : content;
}

function formatRoles(roleIds) {
  return roleIds.length ? roleIds.map((id) => `<@&${id}>`).join(', ') : 'Aucun';
}

function configRows(ticket) {
  const controls = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticketcfg:edit-text').setLabel('Modifier les textes').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('ticketcfg:toggle-mode').setLabel(ticket.useDropdown ? 'Passer en boutons' : 'Passer en menu').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('ticketcfg:add-type').setLabel('Ajouter un type').setStyle(ButtonStyle.Secondary).setDisabled(ticket.types.length >= 25),
    new ButtonBuilder().setCustomId('ticketcfg:remove-type').setLabel('Retirer un type').setStyle(ButtonStyle.Secondary).setDisabled(ticket.types.length === 0),
    new ButtonBuilder().setCustomId('ticketcfg:publish').setLabel('Publier le panneau').setStyle(ButtonStyle.Secondary),
  );
  const supportRoles = new ActionRowBuilder().addComponents(
    new RoleSelectMenuBuilder().setCustomId('ticketcfg:support-roles').setPlaceholder('Rôles support (remplace la sélection)').setMinValues(0).setMaxValues(25),
  );
  const accessRoles = new ActionRowBuilder().addComponents(
    new RoleSelectMenuBuilder().setCustomId('ticketcfg:access-roles').setPlaceholder('Rôles supplémentaires avec accès').setMinValues(0).setMaxValues(25),
  );
  const pingRoles = new ActionRowBuilder().addComponents(
    new RoleSelectMenuBuilder().setCustomId('ticketcfg:ping-roles').setPlaceholder('Rôles à ping à l’ouverture').setMinValues(0).setMaxValues(25),
  );
  const category = new ActionRowBuilder().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId('ticketcfg:category')
      .setPlaceholder('Catégorie où créer les tickets')
      .setChannelTypes(ChannelType.GuildCategory)
      .setMinValues(0)
      .setMaxValues(1),
  );
  const panelChannel = new ActionRowBuilder().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId('ticketcfg:panel-channel')
      .setPlaceholder('Salon de publication du panneau')
      .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
      .setMinValues(0)
      .setMaxValues(1),
  );
  return [controls, supportRoles, accessRoles, pingRoles, category, panelChannel];
}

function textModal() {
  return new ModalBuilder()
    .setCustomId('ticketcfg:modal-text')
    .setTitle('Modifier le panneau')
    .addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('title').setLabel('Titre du panneau').setStyle(TextInputStyle.Short).setMaxLength(100).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('description').setLabel('Description du panneau').setStyle(TextInputStyle.Paragraph).setMaxLength(1500).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('opening').setLabel('Message envoyé dans le ticket ({user})').setStyle(TextInputStyle.Paragraph).setMaxLength(1500).setRequired(true)),
    );
}

function typeModal() {
  return new ModalBuilder()
    .setCustomId('ticketcfg:modal-add-type')
    .setTitle('Ajouter un type de ticket')
    .addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('label').setLabel('Nom affiché').setStyle(TextInputStyle.Short).setMaxLength(80).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('description').setLabel('Description du choix').setStyle(TextInputStyle.Short).setMaxLength(100).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('emoji').setLabel('Emoji (facultatif)').setStyle(TextInputStyle.Short).setMaxLength(20).setRequired(false)),
    );
}

function removeTypeRow(types) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('ticketcfg:select-remove-type')
      .setPlaceholder('Choisir le type à retirer')
      .addOptions(types.map((type) => ({ label: type.label, value: type.id }))),
  );
}

function safeSlug(value) {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'ticket';
}

function getTicketOwner(channel) {
  const match = channel.topic?.match(/ticket-owner=(\d+)/);
  return match?.[1] || null;
}

function getTicketType(channel) {
  const match = channel.topic?.match(/ticket-type=([a-z0-9-]+)/);
  return match?.[1] || null;
}

function hasTicketTopic(channel) {
  return Boolean(getTicketOwner(channel));
}

function isStaff(member, ticket) {
  if (!member) return false;
  if (member.permissions.has(PermissionFlagsBits.ManageGuild) || member.permissions.has(PermissionFlagsBits.ManageChannels)) return true;
  return ticket.supportRoleIds.some((roleId) => member.roles.cache.has(roleId));
}

function canConfigure(interaction) {
  return interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)
    || interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);
}

async function showConfig(interaction) {
  if (!canConfigure(interaction)) {
    return interaction.reply(v2('Tu dois avoir la permission **Gérer le serveur** pour modifier les tickets.', [], true));
  }
  const { ticket } = getConfig(interaction.guildId);
  return interaction.reply(v2(panelText(ticket), configRows(ticket), true));
}

async function publishPanel(interaction, channel) {
  if (!canConfigure(interaction)) {
    return interaction.reply(v2('Tu dois avoir la permission **Gérer le serveur** pour publier le panneau.', [], true));
  }
  const { ticket } = getConfig(interaction.guildId);
  if (!ticket.types.length) return interaction.reply(v2('Ajoute au moins un type de ticket avant de publier le panneau.', [], true));
  const rows = [];
  if (ticket.useDropdown) {
    rows.push(new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('ticket:select-type')
        .setPlaceholder('Choisir le type de ticket')
        .addOptions(ticket.types.map((type) => ({
          label: type.label,
          description: type.description,
          value: type.id,
          ...(type.emoji ? { emoji: type.emoji } : {}),
        }))),
    ));
  } else {
    for (let offset = 0; offset < ticket.types.length; offset += 5) {
      rows.push(new ActionRowBuilder().addComponents(ticket.types.slice(offset, offset + 5).map((type) => {
        const button = new ButtonBuilder().setCustomId(`ticket:open:${type.id}`).setLabel(type.label).setStyle(ButtonStyle.Secondary);
        if (type.emoji) button.setEmoji(type.emoji);
        return button;
      })));
    }
  }
  const target = channel || (ticket.panelChannelId ? await interaction.guild.channels.fetch(ticket.panelChannelId) : null);
  if (!target?.isTextBased() || !target.send) {
    return interaction.reply(v2('Choisis un salon texte dans le panneau de configuration ou avec `/ticket publish salon`.', [], true));
  }
  await target.send(v2(`## ${ticket.title}\n${ticket.description}`, rows));
  updateConfig(interaction.guildId, (config) => ({
    ...config,
    ticket: { ...config.ticket, panelChannelId: target.id },
  }));
  return interaction.reply(v2(`Panneau de tickets publié dans ${target}.`, [], true));
}

async function openTicket(interaction, typeId) {
  const { ticket } = getConfig(interaction.guildId);
  const type = ticket.types.find((item) => item.id === typeId);
  if (!type) return interaction.reply(v2('Ce type de ticket n’est plus disponible. Demande au staff de republier le panneau.', [], true));
  const existing = interaction.guild.channels.cache.find((channel) => (
    channel.type === ChannelType.GuildText && getTicketOwner(channel) === interaction.user.id
  ));
  if (existing) return interaction.reply(v2(`Tu as déjà un ticket ouvert : ${existing}`, [], true));

  const category = ticket.categoryId ? await interaction.guild.channels.fetch(ticket.categoryId) : null;
  if (ticket.categoryId && category?.type !== ChannelType.GuildCategory) {
    throw new Error(`La catégorie de tickets configurée (${ticket.categoryId}) n’existe plus ou n’est pas une catégorie.`);
  }
  const botMember = interaction.guild.members.me;
  if (!botMember) throw new Error('Le membre du bot est introuvable dans ce serveur.');
  const permissionOverwrites = [
    { id: interaction.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles] },
    { id: botMember.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels] },
  ];
  for (const roleId of new Set([...ticket.supportRoleIds, ...ticket.accessRoleIds])) {
    permissionOverwrites.push({
      id: roleId,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
    });
  }
  const name = `ticket-${safeSlug(type.label)}-${safeSlug(interaction.user.username)}`.slice(0, 100);
  const channel = await interaction.guild.channels.create({
    name,
    type: ChannelType.GuildText,
    ...(category?.type === ChannelType.GuildCategory ? { parent: category.id } : {}),
    topic: `ticket-owner=${interaction.user.id};ticket-type=${type.id}`,
    permissionOverwrites,
    reason: `Ticket ${type.label} ouvert par ${interaction.user.tag}`,
  });
  const mentions = ticket.pingRoleIds.map((id) => `<@&${id}>`).join(' ');
  const opening = ticket.openingMessage.replaceAll('{user}', `<@${interaction.user.id}>`);
  const parts = [`## ${type.label}`, opening, mentions].filter(Boolean);
  const actions = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket:claim').setLabel('Prendre en charge').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('ticket:close').setLabel('Fermer').setStyle(ButtonStyle.Secondary),
  );
  await channel.send({
    ...v2(parts.join('\n\n'), [actions]),
    allowedMentions: { users: [interaction.user.id], roles: ticket.pingRoleIds },
  });
  return interaction.reply(v2(`Ton ticket est ouvert : ${channel}`, [], true));
}

async function claimTicket(interaction) {
  const channel = interaction.channel;
  if (!hasTicketTopic(channel)) return interaction.reply(v2('Cette commande doit être utilisée dans un ticket.', [], true));
  if (channel.topic.includes(';ticket-closed=')) return interaction.reply(v2('Ce ticket est fermé et ne peut plus être pris en charge.', [], true));
  const { ticket } = getConfig(interaction.guildId);
  if (!isStaff(interaction.member, ticket)) return interaction.reply(v2('Seul le support peut prendre un ticket en charge.', [], true));
  const claimed = channel.topic.match(/;ticket-claimed=(\d+)/)?.[1];
  if (claimed && claimed !== interaction.user.id) {
    return interaction.reply(v2(`Ce ticket est déjà pris en charge par <@${claimed}>.`, [], true));
  }
  const topic = channel.topic.replace(/;ticket-claimed=\d+/, '');
  if (claimed === interaction.user.id) {
    await channel.setTopic(topic, `Ticket libéré par ${interaction.user.tag}`);
    return interaction.reply(v2(`${interaction.user} libère ce ticket.`));
  }
  await channel.setTopic(`${topic};ticket-claimed=${interaction.user.id}`, `Ticket pris en charge par ${interaction.user.tag}`);
  return interaction.reply(v2(`${interaction.user} prend ce ticket en charge.`));
}

async function closeTicket(interaction) {
  const channel = interaction.channel;
  const ownerId = getTicketOwner(channel);
  if (!ownerId) return interaction.reply(v2('Cette commande doit être utilisée dans un ticket.', [], true));
  const { ticket } = getConfig(interaction.guildId);
  if (interaction.user.id !== ownerId && !isStaff(interaction.member, ticket)) {
    return interaction.reply(v2('Seul l’auteur du ticket ou le support peut le fermer.', [], true));
  }
  const botId = interaction.guild.members.me?.id;
  const overwrites = channel.permissionOverwrites.cache.filter((overwrite) => overwrite.id !== botId);
  await Promise.all(overwrites.map((overwrite) => channel.permissionOverwrites.edit(overwrite.id, {
    ...(overwrite.type === 1 ? { ViewChannel: true, ReadMessageHistory: true } : {}),
    SendMessages: false,
  })));
  if (!channel.name.startsWith('closed-')) await channel.setName(`closed-${channel.name}`.slice(0, 100));
  await channel.setTopic(`${channel.topic};ticket-closed=${Date.now()}`, `Ticket fermé par ${interaction.user.tag}`);
  return interaction.reply(v2(`Ticket fermé par ${interaction.user}. Le salon est archivé et peut être supprimé par le staff.`));
}

async function addTicketMember(interaction, user, remove = false) {
  const channel = interaction.channel;
  if (!hasTicketTopic(channel)) return interaction.reply(v2('Cette commande doit être utilisée dans un ticket.', [], true));
  const { ticket } = getConfig(interaction.guildId);
  if (!isStaff(interaction.member, ticket)) return interaction.reply(v2('Seul le support peut modifier les accès du ticket.', [], true));
  if (remove && user.id === getTicketOwner(channel)) {
    return interaction.reply(v2('L’auteur du ticket ne peut pas être retiré du salon.', [], true));
  }
  await channel.permissionOverwrites.edit(user.id, remove
    ? { ViewChannel: false, SendMessages: false, ReadMessageHistory: false }
    : { ViewChannel: true, SendMessages: true, ReadMessageHistory: true, AttachFiles: true });
  return interaction.reply(v2(remove ? `${user} n’a plus accès à ce ticket.` : `${user} a accès à ce ticket.`));
}

async function renameTicket(interaction, newName) {
  if (!hasTicketTopic(interaction.channel)) return interaction.reply(v2('Cette commande doit être utilisée dans un ticket.', [], true));
  const { ticket } = getConfig(interaction.guildId);
  if (!isStaff(interaction.member, ticket)) return interaction.reply(v2('Seul le support peut renommer ce ticket.', [], true));
  await interaction.channel.setName(safeSlug(newName).slice(0, 100));
  return interaction.reply(v2(`Ticket renommé en **${interaction.channel.name}**.`));
}

async function refreshConfig(interaction) {
  const { ticket } = getConfig(interaction.guildId);
  return interaction.update(v2(panelText(ticket), configRows(ticket), true));
}

async function handleConfigComponent(interaction) {
  if (!canConfigure(interaction)) return interaction.reply(v2('Tu ne peux pas modifier cette configuration.', [], true));
  const id = interaction.customId;
  if (id === 'ticketcfg:edit-text') return interaction.showModal(textModal());
  if (id === 'ticketcfg:add-type') {
    const { ticket } = getConfig(interaction.guildId);
    if (ticket.types.length >= 25) return interaction.reply(v2('Discord limite le menu à 25 types de ticket.', [], true));
    return interaction.showModal(typeModal());
  }
  if (id === 'ticketcfg:toggle-mode') {
    updateConfig(interaction.guildId, (config) => ({ ...config, ticket: { ...config.ticket, useDropdown: !config.ticket.useDropdown } }));
    return refreshConfig(interaction);
  }
  if (id === 'ticketcfg:remove-type') {
    const { ticket } = getConfig(interaction.guildId);
    if (!ticket.types.length) return interaction.reply(v2('Il n’y a aucun type à retirer.', [], true));
    return interaction.reply(v2('Choisis le type à retirer.', [removeTypeRow(ticket.types)], true));
  }
  if (id === 'ticketcfg:publish') return publishPanel(interaction);
  if (id.startsWith('ticketcfg:support-roles') || id.startsWith('ticketcfg:access-roles') || id.startsWith('ticketcfg:ping-roles')) {
    const key = id.split(':')[1] === 'support-roles' ? 'supportRoleIds' : id.split(':')[1] === 'access-roles' ? 'accessRoleIds' : 'pingRoleIds';
    updateConfig(interaction.guildId, (config) => ({ ...config, ticket: { ...config.ticket, [key]: interaction.values } }));
    return refreshConfig(interaction);
  }
  if (id === 'ticketcfg:category' || id === 'ticketcfg:panel-channel') {
    const key = id.endsWith(':category') ? 'categoryId' : 'panelChannelId';
    updateConfig(interaction.guildId, (config) => ({ ...config, ticket: { ...config.ticket, [key]: interaction.values[0] || null } }));
    return refreshConfig(interaction);
  }
  if (id === 'ticketcfg:select-remove-type') {
    const typeId = interaction.values[0];
    updateConfig(interaction.guildId, (config) => ({
      ...config,
      ticket: { ...config.ticket, types: config.ticket.types.filter((type) => type.id !== typeId) },
    }));
    return interaction.update(v2('Type supprimé.\n\n' + panelText(getConfig(interaction.guildId).ticket), configRows(getConfig(interaction.guildId).ticket), true));
  }
  return false;
}

async function handleModal(interaction) {
  if (!canConfigure(interaction)) return interaction.reply(v2('Tu ne peux pas modifier cette configuration.', [], true));
  if (interaction.customId === 'ticketcfg:modal-text') {
    updateConfig(interaction.guildId, (config) => ({
      ...config,
      ticket: {
        ...config.ticket,
        title: interaction.fields.getTextInputValue('title').trim(),
        description: interaction.fields.getTextInputValue('description').trim(),
        openingMessage: interaction.fields.getTextInputValue('opening').trim(),
      },
    }));
  } else if (interaction.customId === 'ticketcfg:modal-add-type') {
    const label = interaction.fields.getTextInputValue('label').trim();
    const description = interaction.fields.getTextInputValue('description').trim();
    const emoji = interaction.fields.getTextInputValue('emoji').trim();
    updateConfig(interaction.guildId, (config) => {
      if (config.ticket.types.length >= 25) throw new Error('Discord limite le menu à 25 types de ticket.');
      const base = safeSlug(label);
      let id = base;
      let suffix = 2;
      while (config.ticket.types.some((type) => type.id === id)) id = `${base}-${suffix++}`;
      const types = [...config.ticket.types, { id, label, description, ...(emoji ? { emoji } : {}) }];
      return { ...config, ticket: { ...config.ticket, types } };
    });
  } else {
    return false;
  }
  const { ticket } = getConfig(interaction.guildId);
  return interaction.reply(v2(panelText(ticket), configRows(ticket), true));
}

async function executeCommand(interaction) {
  const name = interaction.commandName;
  if (name === 'ticket') {
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === 'config') return showConfig(interaction);
    if (subcommand === 'publish') return publishPanel(interaction, interaction.options.getChannel('salon'));
    if (subcommand === 'add') return addTicketMember(interaction, interaction.options.getUser('membre'));
    if (subcommand === 'remove') return addTicketMember(interaction, interaction.options.getUser('membre'), true);
  }
  if (name === 'claim') return claimTicket(interaction);
  if (name === 'close') return closeTicket(interaction);
  if (name === 'rename') return renameTicket(interaction, interaction.options.getString('nom', true));
  return false;
}

async function handleComponent(interaction) {
  if (interaction.customId.startsWith('ticketcfg:')) return handleConfigComponent(interaction);
  if (interaction.customId === 'ticket:select-type') return openTicket(interaction, interaction.values[0]);
  if (interaction.customId.startsWith('ticket:open:')) return openTicket(interaction, interaction.customId.slice('ticket:open:'.length));
  if (interaction.customId === 'ticket:claim') return claimTicket(interaction);
  if (interaction.customId === 'ticket:close') return closeTicket(interaction);
  return false;
}

module.exports = {
  executeCommand,
  handleComponent,
  handleModal,
  getTicketOwner,
  getTicketType,
  hasTicketTopic,
  v2,
};
