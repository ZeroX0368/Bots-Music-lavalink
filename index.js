
require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes, ActivityType, EmbedBuilder } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

// Read config from config.json
const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
const token = config.token;

const express = require('express');
const app = express();
const port = 20247;

app.get('/', (req, res) => {
  res.send('Discord Music Bot is running!');
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Express server running on port ${port}`);
});

const { Manager } = require('erela.js');

const nodes = [{
  host: 'lava-v3.ajieblogs.eu.org',
  port: 80,
  password: 'https://dsc.gg/ajidevserver',
  secure: false,
}];

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const manager = new Manager({
  nodes,
  send(id, payload) {
    const guild = client.guilds.cache.get(id);
    if (guild) guild.shard.send(payload);
  },
  defaultSearchPlatform: 'youtube',
  autoPlay: true,
  clientName: `${client.user?.username || 'Music Bot'}`,
  plugins: []
});

// Store noptoggle settings per channel
const noptoggleChannels = new Map();

// Load commands
const commands = new Map();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  commands.set(command.data.name, command);
}

// Prepare commands for registration
const commandsArray = Array.from(commands.values()).map(command => command.data.toJSON());

const rest = new REST({ version: '10' }).setToken(token);

// Load events
const musicEvents = require('./events/musicEvents');
const buttonEvents = require('./events/buttonEvents');

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  manager.init(client.user.id);

  client.user.setActivity('/bot help', { type: ActivityType.Listening });

  // Register music events
  musicEvents.registerEvents(manager, client, config);

  try {
    console.log('Refreshing slash commands...');
    await rest.put(Routes.applicationCommands(client.user.id), { body: commandsArray });
    console.log('Slash commands registered.');
  } catch (error) {
    console.error(error);
  }
});

client.on('raw', (data) => manager.updateVoiceState(data));

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isCommand() && !interaction.isButton() && !interaction.isStringSelectMenu()) return;

  if (interaction.isButton()) {
    await buttonEvents.handleButtonInteraction(interaction, manager, config);
    return;
  }

  if (interaction.isStringSelectMenu() && interaction.customId === 'filter') {
    const player = manager.players.get(interaction.guild.id);
    if (!player) return;

    const filter = interaction.values[0];
    player.node.send({
      op: 'filters',
      guildId: interaction.guild.id,
      [filter]: true
    });

    const embed = new EmbedBuilder()
      .setDescription(`🎵 Applied filter: ${filter}`)
      .setColor(config.embedColor)
      .setFooter({ 
        text: `Requested by ${interaction.user.tag}`,
        iconURL: interaction.user.displayAvatarURL()
      })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
    return;
  }

  const { commandName } = interaction;
  const command = commands.get(commandName);

  if (!command) return;

  try {
    await command.execute(interaction, manager, config, noptoggleChannels);
  } catch (error) {
    console.error(error);
    await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
  }
});

client.on('messageCreate', async message => {
  if (message.author.bot) return;

  const channelId = message.channel.id;
  if (noptoggleChannels.has(channelId) && noptoggleChannels.get(channelId)) {
    if (message.content.toLowerCase().startsWith('play ')) {
      const query = message.content.substring(5).trim();

      if (!message.member.voice.channel) {
        return message.reply('Join a voice channel first!');
      }

      const player = manager.create({
        guild: message.guild.id,
        voiceChannel: message.member.voice.channel.id,
        textChannel: message.channel.id,
        selfDeafen: true
      });

      if (!player.twentyFourSeven) player.twentyFourSeven = false;

      player.connect();

      const res = await manager.search(query, message.author);

      switch (res.loadType) {
        case 'TRACK_LOADED':
        case 'SEARCH_RESULT':
          if (!res.tracks || res.tracks.length === 0) {
            message.reply('No results found! Please try a different search term.');
            return;
          }
          const track = res.tracks[0];
          player.queue.add(track);
          const embed = new EmbedBuilder()
            .setDescription(`Added [${track.title}](${track.uri}) to the queue`)
            .setColor(config.embedColor)
            .setFooter({ 
              text: `Requested by ${message.author.tag}`,
              iconURL: message.author.displayAvatarURL()
            })
            .setTimestamp();
          message.reply({ embeds: [embed] });
          if (!player.playing && !player.paused) player.play();
          break;
        case 'NO_MATCHES':
          message.reply('No results found! Please try a different search term.');
          break;
        case 'LOAD_FAILED':
          message.reply('Failed to load track! Please try again or use a different link.');
          break;
      }
    }
  }
});

client.login(token);
