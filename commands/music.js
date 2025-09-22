
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

function createMusicEmbed(track, config) {
  return new EmbedBuilder()
    .setTitle('🎵 Now Playing')
    .setDescription(`[${track.title}](${track.uri})`)
    .addFields(
      { name: '👤 Artist', value: track.author, inline: true },
      { name: '⏱️ Duration', value: formatDuration(track.duration), inline: true }
    )
    .setThumbnail(track.thumbnail)
    .setColor(config.embedColor);
}

function formatDuration(duration) {
  const minutes = Math.floor(duration / 60000);
  const seconds = ((duration % 60000) / 1000).toFixed(0);
  return `${minutes}:${seconds.padStart(2, '0')}`;
}

function createControlButtons() {
  return [
    new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('pause')
          .setLabel('Pause/Resume')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('skip')
          .setLabel('Skip')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('stop')
          .setLabel('Stop')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('loop')
          .setLabel('Loop')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('queue')
          .setLabel('Queue')
          .setStyle(ButtonStyle.Secondary)
      )
  ];
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('music')
    .setDescription('Music bot commands')
    .addSubcommand(subcommand =>
      subcommand
        .setName('play')
        .setDescription('Plays a song')
        .addStringOption(option => 
          option.setName('query')
            .setDescription('Song name or URL')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('pause')
        .setDescription('Pause the current song'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('resume')
        .setDescription('Resume the current song'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('skip')
        .setDescription('Skip to the next song'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('queue')
        .setDescription('Show the current queue'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('nowplaying')
        .setDescription('Show currently playing song'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('shuffle')
        .setDescription('Shuffle the queue'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('loop')
        .setDescription('Toggle loop mode')
        .addStringOption(option =>
          option.setName('mode')
            .setDescription('Loop mode')
            .setRequired(true)
            .addChoices(
              { name: 'Off', value: 'off' },
              { name: 'Track', value: 'track' },
              { name: 'Queue', value: 'queue' }
            )))
    .addSubcommand(subcommand =>
      subcommand
        .setName('remove')
        .setDescription('Remove a song from the queue')
        .addIntegerOption(option =>
          option.setName('position')
            .setDescription('Position in queue')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('move')
        .setDescription('Move a song to a different position')
        .addIntegerOption(option =>
          option.setName('from')
            .setDescription('From position')
            .setRequired(true))
        .addIntegerOption(option =>
          option.setName('to')
            .setDescription('To position')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('clearqueue')
        .setDescription('Clear the queue'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('stop')
        .setDescription('Stops the music and leaves'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('volume')
        .setDescription('Set the volume')
        .addIntegerOption(option =>
          option.setName('level')
            .setDescription('Volume level (0-100)')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('247')
        .setDescription('Toggle 24/7 mode'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('noptoggle')
        .setDescription('Toggle auto-play on message')
        .addChannelOption(option =>
          option.setName('channel')
            .setDescription('The channel to toggle auto-play for (optional, defaults to current channel)')
            .setRequired(false))),

  async execute(interaction, manager, config, noptoggleChannels) {
    const { options } = interaction;
    const subcommand = options.getSubcommand();

    if (subcommand === 'play') {
      if (!interaction.member.voice.channel) {
        return interaction.reply({ content: 'Join a voice channel first!', ephemeral: true });
      }

      const player = manager.create({
        guild: interaction.guild.id,
        voiceChannel: interaction.member.voice.channel.id,
        textChannel: interaction.channel.id,
        selfDeafen: true
      });

      if (!player.twentyFourSeven) player.twentyFourSeven = false;

      player.connect();

      const query = options.getString('query');
      const res = await manager.search(query, interaction.user);

      switch (res.loadType) {
        case 'TRACK_LOADED':
        case 'SEARCH_RESULT':
          if (!res.tracks || res.tracks.length === 0) {
            await interaction.reply({ content: 'No results found! Please try a different search term.', ephemeral: true });
            return;
          }
          const track = res.tracks[0];
          player.queue.add(track);
          
          // If no music is currently playing, show Now Playing embed
          if (!player.playing && !player.paused) {
            const embed = createMusicEmbed(track, config);
            const buttons = createControlButtons();
            await interaction.reply({ embeds: [embed], components: buttons });
            // Mark that this track was started via slash command to prevent duplicate embed
            player.set('slashCommandStart', true);
            player.play();
          } else {
            // If music is already playing, just confirm it was added to queue
            await interaction.reply({ content: 'Song added to queue!', ephemeral: true });
          }
          break;
        case 'NO_MATCHES':
          await interaction.reply({ content: 'No results found! Please try a different search term.', ephemeral: true });
          break;
        case 'LOAD_FAILED':
          await interaction.reply({ content: 'Failed to load track! Please try again or use a different link.', ephemeral: true });
          break;
      }
    }

    if (subcommand === 'pause') {
      const player = manager.players.get(interaction.guild.id);
      if (!player) return interaction.reply({ content: 'Not playing anything!', ephemeral: true });

      player.pause(true);
      const embed = new EmbedBuilder()
        .setDescription('⏸️ Paused')
        .setColor(config.embedColor)
        .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
        .setTimestamp();
      await interaction.reply({ embeds: [embed] });
    }

    if (subcommand === 'resume') {
      const player = manager.players.get(interaction.guild.id);
      if (!player) return interaction.reply({ content: 'Not playing anything!', ephemeral: true });

      player.pause(false);
      const embed = new EmbedBuilder()
        .setDescription('▶️ Resumed')
        .setColor(config.embedColor)
        .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
        .setTimestamp();
      await interaction.reply({ embeds: [embed] });
    }

    if (subcommand === 'skip') {
      const player = manager.players.get(interaction.guild.id);
      if (!player) return interaction.reply({ content: 'Not playing anything!', ephemeral: true });

      player.stop();
      const embed = new EmbedBuilder()
        .setDescription('⏭️ Skipped')
        .setColor(config.embedColor)
        .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
        .setTimestamp();
      await interaction.reply({ embeds: [embed] });
    }

    if (subcommand === 'queue') {
      const player = manager.players.get(interaction.guild.id);
      if (!player) return interaction.reply({ content: 'Not playing anything!', ephemeral: true });

      const queue = player.queue;
      const currentTrack = player.queue.current;
      let description = queue.length > 0 ? queue.map((track, i) => 
        `${i + 1}. [${track.title}](${track.uri})`).join('\n') : 'No songs in queue';

      if (currentTrack) description = `**Now Playing:**\n[${currentTrack.title}](${currentTrack.uri})\n\n**Queue:**\n${description}`;

      const embed = new EmbedBuilder()
        .setTitle('🎵 Queue')
        .setDescription(description)
        .setColor(config.embedColor)
        .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
        .setTimestamp();
      await interaction.reply({ embeds: [embed] });
    }

    if (subcommand === 'nowplaying') {
      const player = manager.players.get(interaction.guild.id);
      if (!player) return interaction.reply({ content: 'Not playing anything!', ephemeral: true });

      const track = player.queue.current;
      if (!track) return interaction.reply({ content: 'Not playing anything!', ephemeral: true });

      const embed = createMusicEmbed(track, config);
      await interaction.reply({ embeds: [embed] });
    }

    if (subcommand === 'shuffle') {
      const player = manager.players.get(interaction.guild.id);
      if (!player) return interaction.reply({ content: 'Not playing anything!', ephemeral: true });

      player.queue.shuffle();
      const embed = new EmbedBuilder()
        .setDescription('🔀 Shuffled the queue')
        .setColor(config.embedColor)
        .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
        .setTimestamp();
      await interaction.reply({ embeds: [embed] });
    }

    if (subcommand === 'loop') {
      const player = manager.players.get(interaction.guild.id);
      if (!player) return interaction.reply({ content: 'Not playing anything!', ephemeral: true });

      const mode = options.getString('mode');
      switch (mode) {
        case 'off':
          player.setQueueRepeat(false);
          player.setTrackRepeat(false);
          break;
        case 'track':
          player.setQueueRepeat(false);
          player.setTrackRepeat(true);
          break;
        case 'queue':
          player.setQueueRepeat(true);
          player.setTrackRepeat(false);
          break;
      }

      const embed = new EmbedBuilder()
        .setDescription(`🔄 Loop mode set to: ${mode}`)
        .setColor(config.embedColor)
        .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
        .setTimestamp();
      await interaction.reply({ embeds: [embed] });
    }

    if (subcommand === 'remove') {
      const player = manager.players.get(interaction.guild.id);
      if (!player) return interaction.reply({ content: 'Not playing anything!', ephemeral: true });

      const pos = options.getInteger('position') - 1;
      if (pos < 0 || pos >= player.queue.length) {
        return interaction.reply({ content: 'Invalid position!', ephemeral: true });
      }

      const removed = player.queue.remove(pos);
      const embed = new EmbedBuilder()
        .setDescription(`❌ Removed [${removed.title}](${removed.uri})`)
        .setColor(config.embedColor)
        .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
        .setTimestamp();
      await interaction.reply({ embeds: [embed] });
    }

    if (subcommand === 'move') {
      const player = manager.players.get(interaction.guild.id);
      if (!player) return interaction.reply({ content: 'Not playing anything!', ephemeral: true });

      const from = options.getInteger('from') - 1;
      const to = options.getInteger('to') - 1;

      if (from < 0 || from >= player.queue.length || to < 0 || to >= player.queue.length) {
        return interaction.reply({ content: 'Invalid position!', ephemeral: true });
      }

      const track = player.queue[from];
      player.queue.remove(from);
      player.queue.add(track, to);

      const embed = new EmbedBuilder()
        .setDescription(`📦 Moved [${track.title}](${track.uri}) to position ${to + 1}`)
        .setColor(config.embedColor)
        .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
        .setTimestamp();
      await interaction.reply({ embeds: [embed] });
    }

    if (subcommand === 'clearqueue') {
      const player = manager.players.get(interaction.guild.id);
      if (!player) return interaction.reply({ content: 'Not playing anything!', ephemeral: true });

      player.queue.clear();
      const embed = new EmbedBuilder()
        .setDescription('🗑️ Cleared the queue')
        .setColor(config.embedColor)
        .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
        .setTimestamp();
      await interaction.reply({ embeds: [embed] });
    }

    if (subcommand === 'stop') {
      const player = manager.players.get(interaction.guild.id);
      if (player) {
        player.set('manualStop', true);
        const stopMessage = player.get('currentMessage');
        if (stopMessage && stopMessage.editable) {
          const disabledButtons = stopMessage.components[0].components.map(button => {
            return ButtonBuilder.from(button).setDisabled(true);
          });
          stopMessage.edit({ components: [new ActionRowBuilder().addComponents(disabledButtons)] });
        }
        const stopEmbed = new EmbedBuilder()
          .setDescription('Queue has ended!')
          .setColor(config.embedColor)
          .setTimestamp();
        await interaction.channel.send({ embeds: [stopEmbed] });
        player.destroy();
        await interaction.reply({ content: '⏹️ Stopped the music and left', ephemeral: true });
      } else {
        await interaction.reply({ content: 'Not playing anything!', ephemeral: true });
      }
    }

    if (subcommand === 'volume') {
      const player = manager.players.get(interaction.guild.id);
      if (!player) return interaction.reply({ content: 'Not playing anything!', ephemeral: true });

      const volume = options.getInteger('level');
      if (volume < 0 || volume > 100) {
        return interaction.reply({ content: 'Volume must be between 0 and 100!', ephemeral: true });
      }

      player.setVolume(volume);
      await interaction.reply(`🔊 Volume set to ${volume}%`);
    }

    if (subcommand === '247') {
      const player = manager.players.get(interaction.guild.id);
      if (!player) return interaction.reply({ content: 'No music is playing!', ephemeral: true });

      player.twentyFourSeven = !player.twentyFourSeven;
      const embed = new EmbedBuilder()
        .setDescription(`🎵 24/7 mode is now ${player.twentyFourSeven ? 'enabled' : 'disabled'}`)
        .setColor(config.embedColor)
        .setFooter({ 
          text: `Requested by ${interaction.user.tag}`,
          iconURL: interaction.user.displayAvatarURL()
        })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    }

    if (subcommand === 'noptoggle') {
      // Check if user has Manage Channels permission
      if (!interaction.member.permissions.has('ManageChannels')) {
        return interaction.reply({ 
          content: '❌ You need the "Manage Channels" permission to use this command!', 
          ephemeral: true 
        });
      }

      // Check if bot has Manage Channels permission
      if (!interaction.guild.members.me.permissions.has('ManageChannels')) {
        return interaction.reply({ 
          content: '❌ I need the "Manage Channels" permission to use this feature!', 
          ephemeral: true 
        });
      }

      const channel = options.getChannel('channel') || interaction.channel;
      const channelId = channel.id;

      const currentSetting = noptoggleChannels.get(channelId) || false;
      noptoggleChannels.set(channelId, !currentSetting);

      const embed = new EmbedBuilder()
        .setDescription(`🎵 Auto-play for ${channel} is now ${!currentSetting ? 'enabled' : 'disabled'}\n\n• Just type command names directly\n• Example: \`play never gonna give you up\`\n• This works in all servers where I'm present`)
        .setColor(config.embedColor)
        .setFooter({ 
          text: `Requested by ${interaction.user.tag}`,
          iconURL: interaction.user.displayAvatarURL()
        })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    }
  },

  createMusicEmbed,
  createControlButtons,
  formatDuration
};
