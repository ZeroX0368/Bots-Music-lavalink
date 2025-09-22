
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder } = require('discord.js');

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
          .setStyle('Primary'),
        new ButtonBuilder()
          .setCustomId('skip')
          .setLabel('Skip')
          .setStyle('Secondary'),
        new ButtonBuilder()
          .setCustomId('stop')
          .setLabel('Stop')
          .setStyle('Danger'),
        new ButtonBuilder()
          .setCustomId('loop')
          .setLabel('Loop')
          .setStyle('Secondary'),
        new ButtonBuilder()
          .setCustomId('queue')
          .setLabel('Queue')
          .setStyle('Secondary')
      )
  ];
}

module.exports = {
  registerEvents(manager, client, config) {
    manager.on('nodeConnect', (node) => {
      console.log(`Node ${node.options.identifier} connected`);
    });

    manager.on('nodeError', (node, error) => {
      console.error(`Node ${node.options.identifier} error:`, error.message);
    });

    manager.on('trackStart', (player, track) => {
      // Skip sending embed if this track was started via slash command
      if (player.get('slashCommandStart')) {
        player.set('slashCommandStart', undefined);
        return;
      }
      
      const channel = client.channels.cache.get(player.textChannel);
      if (channel) {
        const embed = createMusicEmbed(track, config);
        const buttons = createControlButtons();
        channel.send({ embeds: [embed], components: buttons }).then(msg => {
          player.set('currentMessage', msg);
        });
      }
    });

    manager.on('queueEnd', (player) => {
      if (player.get('manualStop')) return;

      const channel = client.channels.cache.get(player.textChannel);
      if (channel) {
        const queueEndEmbed = new EmbedBuilder()
          .setDescription('Queue has ended!')
          .setColor(config.embedColor)
          .setTimestamp();
        channel.send({ embeds: [queueEndEmbed] });

        const message = player.get('currentMessage');
        if (message && message.editable) {
          const disabledButtons = message.components[0].components.map(button => {
            return ButtonBuilder.from(button).setDisabled(true);
          });
          message.edit({ components: [new ActionRowBuilder().addComponents(disabledButtons)] });
        }
      }
    });
  }
};
