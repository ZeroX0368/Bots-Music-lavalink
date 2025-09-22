
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

function createMusicCard(player, config) {
  const track = player.queue.current;
  if (!track) return null;

  const progressBar = createProgressBar(player.position, track.duration);

  const embed = new EmbedBuilder()
    .setTitle('🎵 Music Player')
    .setDescription(`**[${track.title}](${track.uri})**\nby ${track.author}`)
    .addFields(
      { name: '⏱️ Progress', value: `${formatDuration(player.position)} / ${formatDuration(track.duration)}`, inline: true },
      { name: '🔊 Volume', value: `${player.volume}%`, inline: true },
      { name: '🔁 Loop', value: player.queueRepeat ? 'Queue' : player.trackRepeat ? 'Track' : 'Off', inline: true },
      { name: '📊 Progress Bar', value: progressBar, inline: false }
    )
    .setThumbnail(track.thumbnail)
    .setColor(config.embedColor)
    .setTimestamp();

  const buttons = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('musiccard_previous')
        .setEmoji('⏮️')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('musiccard_pause')
        .setEmoji(player.paused ? '▶️' : '⏸️')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('musiccard_skip')
        .setEmoji('⏭️')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('musiccard_stop')
        .setEmoji('⏹️')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('musiccard_refresh')
        .setEmoji('🔄')
        .setStyle(ButtonStyle.Secondary)
    );

  const secondRow = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('musiccard_shuffle')
        .setEmoji('🔀')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('musiccard_loop')
        .setEmoji('🔁')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('musiccard_queue')
        .setEmoji('📜')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('musiccard_volume_down')
        .setEmoji('🔉')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('musiccard_volume_up')
        .setEmoji('🔊')
        .setStyle(ButtonStyle.Secondary)
    );

  return { embeds: [embed], components: [buttons, secondRow] };
}

function createProgressBar(current, total) {
  const percentage = (current / total) * 100;
  const progressBarLength = 20;
  const filledLength = Math.round((percentage / 100) * progressBarLength);
  const emptyLength = progressBarLength - filledLength;

  const progressBar = '█'.repeat(filledLength) + '░'.repeat(emptyLength);
  return `${progressBar} ${Math.round(percentage)}%`;
}

function formatDuration(duration) {
  const minutes = Math.floor(duration / 60000);
  const seconds = ((duration % 60000) / 1000).toFixed(0);
  return `${minutes}:${seconds.padStart(2, '0')}`;
}

module.exports = {
  async handleButtonInteraction(interaction, manager, config) {
    if (!interaction.member.voice.channel) {
      return interaction.reply({ content: 'You need to join a voice channel to use the buttons!', ephemeral: true });
    }
    
    const player = manager.players.get(interaction.guild.id);
    if (!player) return interaction.reply({ content: 'No music is playing!', ephemeral: true });

    // Handle music card buttons
    if (interaction.customId.startsWith('musiccard_')) {
      const action = interaction.customId.replace('musiccard_', '');

      switch (action) {
        case 'pause':
          player.pause(!player.paused);
          const musicCard = createMusicCard(player, config);
          if (musicCard) {
            await interaction.update(musicCard);
          }
          break;
        case 'skip':
          if (player.queue.length === 0) {
            await interaction.reply({ content: 'No more songs in queue!', ephemeral: true });
            return;
          }
          player.stop();
          await interaction.reply({ content: 'Skipped to next song!', ephemeral: true });
          break;
        case 'previous':
          await interaction.reply({ content: 'Previous functionality not available with current setup!', ephemeral: true });
          break;
        case 'stop':
          player.destroy();
          await interaction.reply({ content: 'Music stopped and disconnected!', ephemeral: true });
          break;
        case 'shuffle':
          player.queue.shuffle();
          await interaction.reply({ content: 'Queue shuffled!', ephemeral: true });
          break;
        case 'loop':
          if (player.queueRepeat) {
            player.setQueueRepeat(false);
            player.setTrackRepeat(true);
          } else if (player.trackRepeat) {
            player.setTrackRepeat(false);
          } else {
            player.setQueueRepeat(true);
          }
          const updatedCard = createMusicCard(player, config);
          if (updatedCard) {
            await interaction.update(updatedCard);
          }
          break;
        case 'queue':
          const queue = player.queue;
          const currentTrack = player.queue.current;
          let description = queue.length > 0 ? queue.slice(0, 10).map((track, i) => 
            `${i + 1}. [${track.title}](${track.uri})`).join('\n') : 'No songs in queue';

          if (currentTrack) description = `**Now Playing:**\n[${currentTrack.title}](${currentTrack.uri})\n\n**Queue:**\n${description}`;

          const embed = new EmbedBuilder()
            .setTitle('Queue')
            .setDescription(description)
            .setColor(config.embedColor)
            .setTimestamp();
          await interaction.reply({ embeds: [embed], ephemeral: true });
          break;
        case 'volume_up':
          const newVolumeUp = Math.min(player.volume + 10, 100);
          player.setVolume(newVolumeUp);
          const cardUp = createMusicCard(player, config);
          if (cardUp) {
            await interaction.update(cardUp);
          }
          break;
        case 'volume_down':
          const newVolumeDown = Math.max(player.volume - 10, 0);
          player.setVolume(newVolumeDown);
          const cardDown = createMusicCard(player, config);
          if (cardDown) {
            await interaction.update(cardDown);
          }
          break;
        case 'refresh':
          const refreshedCard = createMusicCard(player, config);
          if (refreshedCard) {
            await interaction.update(refreshedCard);
          }
          break;
      }
      return;
    }

    // Handle regular control buttons
    const currentTrack = player.queue.current;
    if (!currentTrack) return;

    if (currentTrack.requester.id !== interaction.user.id) {
      return interaction.reply({ content: 'Only the person who requested this song can use these buttons!', ephemeral: true });
    }

    switch (interaction.customId) {
      case 'pause':
        player.pause(!player.paused);
        await interaction.reply({ content: player.paused ? 'Paused' : 'Resumed', ephemeral: true });
        break;
      case 'skip':
        const skipMessage = player.get('currentMessage');
        if (skipMessage && skipMessage.editable) {
          const disabledButtons = skipMessage.components[0].components.map(button => {
            return ButtonBuilder.from(button).setDisabled(true);
          });
          skipMessage.edit({ components: [new ActionRowBuilder().addComponents(disabledButtons)] });
        }
        if (player.queue.length === 0) {
          const queueEndEmbed = new EmbedBuilder()
            .setDescription('Queue has ended!')
            .setColor(config.embedColor)
            .setTimestamp();
          await interaction.channel.send({ embeds: [queueEndEmbed] });
          player.set('manualStop', true);
        }
        player.stop();
        await interaction.reply({ content: 'Skipped', ephemeral: true });
        break;
      case 'stop':
        const stopMessage = player.get('currentMessage');
        if (stopMessage && stopMessage.editable) {
          const disabledButtons = stopMessage.components[0].components.map(button => {
            return ButtonBuilder.from(button).setDisabled(true);
          });
          stopMessage.edit({ components: [new ActionRowBuilder().addComponents(disabledButtons)] });
        }
        player.set('manualStop', true);
        const stopEmbed = new EmbedBuilder()
          .setDescription('Queue has ended!')
          .setColor(config.embedColor)
          .setTimestamp();
        await interaction.channel.send({ embeds: [stopEmbed] });
        player.destroy();
        await interaction.reply({ content: 'Stopped', ephemeral: true });
        break;
      case 'loop':
        player.setQueueRepeat(!player.queueRepeat);
        await interaction.reply({ content: `Loop: ${player.queueRepeat ? 'Enabled' : 'Disabled'}`, ephemeral: true });
        break;
      case 'queue':
        const queue = player.queue;
        const currentTrack = player.queue.current;
        let description = queue.length > 0 ? queue.map((track, i) => 
          `${i + 1}. [${track.title}](${track.uri})`).join('\n') : 'No songs in queue';

        if (currentTrack) description = `**Now Playing:**\n[${currentTrack.title}](${currentTrack.uri})\n\n**Queue:**\n${description}`;

        const embed = new EmbedBuilder()
          .setTitle('Queue')
          .setDescription(description)
          .setColor(config.embedColor)
          .setTimestamp();
        await interaction.reply({ embeds: [embed], ephemeral: true });
        break;
    }
  }
};
