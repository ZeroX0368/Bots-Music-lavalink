
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('bot')
    .setDescription('Bot management and information commands')
.setDefaultMemberPermissions(PermissionFlagsBits.UseApplicationCommands)
    .addSubcommand(subcommand =>
      subcommand
        .setName('uptime')
        .setDescription('Shows bot uptime'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('ping')
        .setDescription('Shows bot ping/latency'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('invite')
        .setDescription('Get bot invite link'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('support')
        .setDescription('Get support server link'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('feedback')
        .setDescription('Send feedback to developers')
        .addStringOption(option =>
          option.setName('message')
            .setDescription('Your feedback message')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('serverlist')
        .setDescription('Shows list of servers bot is in (Owner only)'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('leave')
        .setDescription('Make bot leave a server (Owner only)')
        .addStringOption(option =>
          option.setName('serverid')
            .setDescription('Server ID to leave')
            .setRequired(true))),

  async execute(interaction, manager, config) {
    const { options } = interaction;
    const subcommand = options.getSubcommand();

    // Check bot permissions for certain commands
    const botPermissions = interaction.guild?.members?.me?.permissions;
    if (!botPermissions?.has(PermissionFlagsBits.SendMessages)) {
      return interaction.reply({ 
        content: '❌ I need "Send Messages" permission to execute this command!', 
        ephemeral: true 
      });
    }

    // Check if bot has UseApplicationCommands permission
    if (!botPermissions?.has(PermissionFlagsBits.UseApplicationCommands)) {
      return interaction.reply({ 
        content: '❌ I need "Use Application Commands" permission to execute this command!', 
        ephemeral: true 
      });
    }

    // Check if user has UseApplicationCommands permission
    const userPermissions = interaction.member?.permissions;
    if (!userPermissions?.has(PermissionFlagsBits.UseApplicationCommands)) {
      return interaction.reply({ 
        content: '❌ You need "Use Application Commands" permission to use this command!', 
        ephemeral: true 
      });
    }

    if (subcommand === 'uptime') {
      const uptime = process.uptime();
      const days = Math.floor(uptime / 86400);
      const hours = Math.floor(uptime / 3600) % 24;
      const minutes = Math.floor(uptime / 60) % 60;
      const seconds = Math.floor(uptime % 60);

      const embed = new EmbedBuilder()
        .setTitle('🕒 Bot Uptime')
        .setDescription(`${days}d ${hours}h ${minutes}m ${seconds}s`)
        .setColor(config.embedColor)
        .setFooter({ 
          text: `Requested by ${interaction.user.tag}`,
          iconURL: interaction.user.displayAvatarURL()
        })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    }

    if (subcommand === 'ping') {
      const sent = await interaction.reply({ content: 'Pinging...', fetchReply: true });
      const timeDiff = sent.createdTimestamp - interaction.createdTimestamp;

      const embed = new EmbedBuilder()
        .setTitle('🏓 Pong!')
        .addFields(
          { name: 'Roundtrip latency', value: `${timeDiff}ms`, inline: true },
          { name: 'Websocket heartbeat', value: `${interaction.client.ws.ping}ms`, inline: true }
        )
        .setColor(config.embedColor)
        .setFooter({ 
          text: `Requested by ${interaction.user.tag}`,
          iconURL: interaction.user.displayAvatarURL()
        })
        .setTimestamp();

      await interaction.editReply({ content: '', embeds: [embed] });
    }

    if (subcommand === 'invite') {
      const inviteUrl = `https://discord.com/api/oauth2/authorize?client_id=${interaction.client.user.id}&permissions=8&scope=bot%20applications.commands`;
      
      const embed = new EmbedBuilder()
        .setTitle('📨 Invite Me!')
        .setDescription(`[Click here to invite me to your server!](${inviteUrl})`)
        .setColor(config.embedColor)
        .setFooter({ 
          text: `Requested by ${interaction.user.tag}`,
          iconURL: interaction.user.displayAvatarURL()
        })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    }

    if (subcommand === 'support') {
      const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
      
      const embed = new EmbedBuilder()
        .setTitle('Support Server')
        .setDescription(`Need help? Join our support server!`)
        .setColor(config.embedColor)
        .setFooter({ 
          text: `Requested by ${interaction.user.tag}`,
          iconURL: interaction.user.displayAvatarURL()
        })
        .setTimestamp();

      const supportButton = new ButtonBuilder()
        .setLabel('Join Server')
        .setStyle(ButtonStyle.Link)
        .setURL(config.SUPPORT_SERVER)
        .setEmoji('🆘');

      const row = new ActionRowBuilder()
        .addComponents(supportButton);

      await interaction.reply({ embeds: [embed], components: [row] });
    }

    

    if (subcommand === 'feedback') {
      const feedbackMessage = options.getString('message');
      
      try {
        const feedbackChannel = interaction.client.channels.cache.get(config.ChannelFeedBackID);
        if (!feedbackChannel) {
          return interaction.reply({ 
            content: '❌ Feedback channel not found! Please contact the bot owner.', 
            ephemeral: true 
          });
        }

        const feedbackEmbed = new EmbedBuilder()
          .setTitle('📝 New Feedback')
          .setDescription(feedbackMessage)
          .addFields(
            { name: '👤 User', value: `${interaction.user.tag} (${interaction.user.id})`, inline: true },
            { name: '🌐 Server', value: `${interaction.guild?.name || 'DM'} (${interaction.guild?.id || 'N/A'})`, inline: true }
          )
          .setThumbnail(interaction.user.displayAvatarURL())
          .setColor(config.embedColor)
          .setTimestamp();

        await feedbackChannel.send({ embeds: [feedbackEmbed] });

        const confirmEmbed = new EmbedBuilder()
          .setDescription('✅ Your feedback has been sent successfully! Thank you for helping us improve.')
          .setColor(config.embedColor)
          .setTimestamp();

        await interaction.reply({ embeds: [confirmEmbed], ephemeral: true });
      } catch (error) {
        console.error('Feedback error:', error);
        await interaction.reply({ 
          content: '❌ Failed to send feedback. Please try again later.', 
          ephemeral: true 
        });
      }
    }

    if (subcommand === 'serverlist') {
      // Owner only command
      if (interaction.user.id !== config.ownerId) {
        return interaction.reply({ 
          content: '❌ This command is only available to the bot owner!', 
          ephemeral: true 
        });
      }

      const guilds = interaction.client.guilds.cache.map(guild => 
        `**${guild.name}** (${guild.id}) - ${guild.memberCount} members`
      );

      const chunks = [];
      for (let i = 0; i < guilds.length; i += 10) {
        chunks.push(guilds.slice(i, i + 10));
      }

      if (chunks.length === 0) {
        return interaction.reply({ content: 'No servers found.', ephemeral: true });
      }

      const embed = new EmbedBuilder()
        .setTitle(`📋 Server List (${guilds.length} total)`)
        .setDescription(chunks[0].join('\n'))
        .setColor(config.embedColor)
        .setFooter({ text: `Page 1/${chunks.length}` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (subcommand === 'leave') {
      // Owner only command
      if (interaction.user.id !== config.ownerId) {
        return interaction.reply({ 
          content: '❌ This command is only available to the bot owner!', 
          ephemeral: true 
        });
      }

      const serverId = options.getString('serverid');
      const guild = interaction.client.guilds.cache.get(serverId);

      if (!guild) {
        return interaction.reply({ 
          content: '❌ Server not found! Make sure the server ID is correct.', 
          ephemeral: true 
        });
      }

      try {
        const guildName = guild.name;
        await guild.leave();
        
        const embed = new EmbedBuilder()
          .setDescription(`✅ Successfully left server: **${guildName}** (${serverId})`)
          .setColor(config.embedColor)
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
      } catch (error) {
        console.error('Leave server error:', error);
        await interaction.reply({ 
          content: '❌ Failed to leave server. Please try again later.', 
          ephemeral: true 
        });
      }
    }
  }
};
