const fs = require('node:fs');
const path = require('node:path');

const dataDirectory = path.join(__dirname, 'data');
const configPath = path.join(dataDirectory, 'guildConfigs.json');

function defaultConfig() {
  return {
    ticket: {
      title: 'Centre de support',
      description: 'Choisis une option ci-dessous pour ouvrir un ticket.',
      openingMessage: 'Bonjour {user}, explique ta demande ici. Le support te répondra dès que possible.',
      useDropdown: true,
      categoryId: null,
      panelChannelId: null,
      supportRoleIds: [],
      accessRoleIds: [],
      pingRoleIds: [],
      types: [
        {
          id: 'assistance',
          label: 'Assistance',
          description: 'Ouvrir un ticket auprès du support',
          emoji: '🎫',
        },
      ],
    },
  };
}

function readAll() {
  fs.mkdirSync(dataDirectory, { recursive: true });
  if (!fs.existsSync(configPath)) return {};

  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (error) {
    throw new Error(`Impossible de lire ${configPath}: ${error.message}`);
  }
}

function writeAll(data) {
  fs.mkdirSync(dataDirectory, { recursive: true });
  try {
    fs.writeFileSync(configPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  } catch (error) {
    throw new Error(`Impossible d'enregistrer ${configPath}: ${error.message}`);
  }
}

function getConfig(guildId) {
  const all = readAll();
  const saved = all[guildId] || {};
  const base = defaultConfig();
  return {
    ...base,
    ...saved,
    ticket: { ...base.ticket, ...(saved.ticket || {}) },
  };
}

function updateConfig(guildId, updater) {
  const all = readAll();
  const config = getConfig(guildId);
  const updated = updater(config);
  all[guildId] = updated;
  writeAll(all);
  return updated;
}

module.exports = { defaultConfig, getConfig, updateConfig };
