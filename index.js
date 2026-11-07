const {
  ActivityType,
  Client,
  ChannelType,
  Events,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
} = require('discord.js');
require('dotenv').config();
const tickets = require('./tickets');
const features = require('./features');

const { TOKEN, CLIENT_ID, GUILD_ID } = process.env;
if (!TOKEN || !CLIENT_ID) {
  console.error('Variables TOKEN et CLIENT_ID obligatoires. Copie env.example en .env puis complète-le.');
  process.exit(1);
}

const commands = [
  new SlashCommandBuilder()
    .setName('help')
    .setDescription('Afficher les commandes disponibles'),
  new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Configurer et gérer les tickets')
    .addSubcommand((command) => command.setName('config').setDescription('Ouvrir le panneau de configuration des tickets'))
    .addSubcommand((command) => command
      .setName('publish')
      .setDescription('Publier le panneau de tickets dans un salon')
      .addChannelOption((option) => option
        .setName('salon')
        .setDescription('Salon texte où publier le panneau')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setRequired(true)))
    .addSubcommand((command) => command
      .setName('add')
      .setDescription('Donner accès à un membre dans ce ticket')
      .addUserOption((option) => option.setName('membre').setDescription('Membre à ajouter').setRequired(true)))
    .addSubcommand((command) => command
      .setName('remove')
      .setDescription('Retirer l’accès d’un membre dans ce ticket')
      .addUserOption((option) => option.setName('membre').setDescription('Membre à retirer').setRequired(true))),
  new SlashCommandBuilder()
    .setName('claim')
    .setDescription('Prendre en charge ou libérer un ticket'),
  new SlashCommandBuilder()
    .setName('close')
    .setDescription('Fermer et archiver le ticket courant'),
  new SlashCommandBuilder()
    .setName('rename')
    .setDescription('Renommer le ticket courant')
    .addStringOption((option) => option.setName('nom').setDescription('Nouveau nom du ticket').setRequired(true).setMaxLength(80)),
  ...features.commands,
].map((command) => typeof command.toJSON === 'function' ? command.toJSON() : command);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.MessageContent,
  ],
});
const rest = new REST({ version: '10' }).setToken(TOKEN);

function helpPayload() {
  const groups = [
    ['Configuration', ['/acces', '/automod', '/config', '/logs', '/owner', '/serveurs']],
    ['Utilitaires', ['/cinvite', '/compteur', '/dero', '/embed', '/everyone', '/ghostping', '/help', '/leaderboard', '/menu', '/report', '/soutien', '/sync', '/welcome']],
    ['Tickets', ['/claim', '/close', '/rename', '/ticket']],
    ['Giveaway', ['/check', '/giveaway']],
    ['Invitations', ['/config-invite', '/invite', '/lb-invite', '/reset-invite']],
  ];
  return tickets.v2([
    '## Aide — commandes disponibles',
    ...groups.map(([title, names]) => `### ${title}\n${names.map((name) => `\`${name}\``).join(' • ')}`),
    '',
    '-# Les commandes nécessitant une configuration ou des permissions répondent dans le serveur.',
  ].join('\n\n'), [], true);
}

client.once(Events.ClientReady, async (readyClient) => {
  readyClient.user.setPresence({
    activities: [{ name: 'les tickets', type: ActivityType.Watching }],
  });
  try {
    await features.onReady(readyClient);
  } catch (error) {
    console.error('Initialisation des statistiques et invitations impossible :', error);
  }
  try {
    const route = GUILD_ID
      ? Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID)
      : Routes.applicationCommands(CLIENT_ID);
    await rest.put(route, { body: commands });
    console.log(`${commands.length} commandes déployées${GUILD_ID ? ` sur le serveur ${GUILD_ID}` : ' globalement'}.`);
  } catch (error) {
    console.error('Échec du déploiement des commandes :', error);
  }
  console.log(`Connecté en tant que ${readyClient.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (!interaction.inGuild()) {
      if (interaction.isChatInputCommand()) {
        await interaction.reply(tickets.v2('Ces commandes sont disponibles uniquement sur un serveur Discord.', [], true));
      }
      return;
    }
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === 'help') return await interaction.reply(helpPayload());
      const ticketCommands = new Set(['ticket', 'claim', 'close', 'rename']);
      const handled = ticketCommands.has(interaction.commandName)
        ? await tickets.executeCommand(interaction)
        : await features.execute(interaction);
      if (!handled) await interaction.reply(tickets.v2('Commande non reconnue.', [], true));
      return;
    }
    if (interaction.isButton() || interaction.isStringSelectMenu() || interaction.isRoleSelectMenu() || interaction.isChannelSelectMenu()) {
      const handled = await tickets.handleComponent(interaction) || await features.handleComponent(interaction);
      if (handled === false) return;
      return;
    }
    if (interaction.isModalSubmit()) {
      const handled = await tickets.handleModal(interaction);
      if (handled === false) return;
    }
  } catch (error) {
    console.error(`Erreur pendant l’interaction ${interaction.id}:`, error);
    const payload = tickets.v2('Une erreur est survenue. Consulte les logs du bot ou réessaie.', [], true);
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(payload).catch((followUpError) => {
        console.error('Impossible de signaler l’erreur à l’utilisateur :', followUpError);
      });
    } else {
      await interaction.reply(payload).catch((replyError) => {
        console.error('Impossible de signaler l’erreur à l’utilisateur :', replyError);
      });
    }
  }
});

client.on(Events.MessageCreate, (message) => {
  features.onMessage(message).catch((error) => console.error('Erreur MessageCreate :', error));
});
client.on(Events.MessageDelete, (message) => {
  features.onMessageDelete(message).catch((error) => console.error('Erreur MessageDelete :', error));
});
client.on(Events.MessageUpdate, (oldMessage, newMessage) => {
  features.onMessageUpdate(oldMessage, newMessage).catch((error) => console.error('Erreur MessageUpdate :', error));
});
client.on(Events.GuildMemberAdd, (member) => {
  features.onMemberAdd(member).catch((error) => console.error('Erreur GuildMemberAdd :', error));
});
client.on(Events.GuildMemberRemove, (member) => {
  features.onMemberRemove(member).catch((error) => console.error('Erreur GuildMemberRemove :', error));
});
client.on(Events.VoiceStateUpdate, (oldState, newState) => {
  features.onVoiceStateUpdate(oldState, newState).catch((error) => console.error('Erreur VoiceStateUpdate :', error));
});
client.on(Events.InviteCreate, (invite) => {
  features.onInviteCreate(invite).catch((error) => console.error('Erreur InviteCreate :', error));
});
client.on(Events.InviteDelete, (invite) => {
  features.onInviteDelete(invite).catch((error) => console.error('Erreur InviteDelete :', error));
});

client.login(TOKEN).catch((error) => {
  console.error('Connexion Discord impossible :', error);
  process.exitCode = 1;
});