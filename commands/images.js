
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

module.exports = {
  data: new SlashCommandBuilder()
    .setName('images')
    .setDescription('Get random animal images')
    .setDefaultMemberPermissions(PermissionFlagsBits.UseApplicationCommands)
    .addSubcommandGroup(subcommandGroup =>
      subcommandGroup
        .setName('animal')
        .setDescription('Get random animal images')
        .addSubcommand(subcommand =>
          subcommand
            .setName('dog')
            .setDescription('Get a random dog image'))
        .addSubcommand(subcommand =>
          subcommand
            .setName('cat')
            .setDescription('Get a random cat image'))
        .addSubcommand(subcommand =>
          subcommand
            .setName('fox')
            .setDescription('Get a random fox image'))
        .addSubcommand(subcommand =>
          subcommand
            .setName('red_panda')
            .setDescription('Get a random red panda image'))
        .addSubcommand(subcommand =>
          subcommand
            .setName('panda')
            .setDescription('Get a random panda image'))),

  async execute(interaction, manager, config) {
    const { options } = interaction;
    const subcommandGroup = options.getSubcommandGroup();
    const subcommand = options.getSubcommand();

    // Check bot permissions
    const botPermissions = interaction.guild?.members?.me?.permissions;
    if (!botPermissions?.has(PermissionFlagsBits.SendMessages)) {
      return interaction.reply({ 
        content: '❌ I need "Send Messages" permission to execute this command!', 
        ephemeral: true 
      });
    }

    // Check user permissions
    const userPermissions = interaction.member?.permissions;
    if (!userPermissions?.has(PermissionFlagsBits.UseApplicationCommands)) {
      return interaction.reply({ 
        content: '❌ You need "Use Application Commands" permission to use this command!', 
        ephemeral: true 
      });
    }

    if (subcommandGroup === 'animal') {
      await interaction.deferReply();

      try {
        let apiUrl;
        let animalName;

        switch (subcommand) {
          case 'dog':
            apiUrl = 'https://dog.ceo/api/breeds/image/random';
            animalName = 'Dog';
            break;
          case 'cat':
            apiUrl = 'https://api.thecatapi.com/v1/images/search';
            animalName = 'Cat';
            break;
          case 'fox':
            apiUrl = 'https://randomfox.ca/floof/';
            animalName = 'Fox';
            break;
          case 'red_panda':
            apiUrl = 'https://some-random-api.com/animal/red_panda';
            animalName = 'Red Panda';
            break;
          case 'panda':
            apiUrl = 'https://some-random-api.com/animal/panda';
            animalName = 'Panda';
            break;
          default:
            return interaction.editReply({ content: 'Invalid animal type!' });
        }

        const response = await fetch(apiUrl);
        if (!response.ok) {
          throw new Error(`API request failed with status ${response.status}`);
        }

        const data = await response.json();
        let imageUrl;

        // Handle different API response formats
        switch (subcommand) {
          case 'dog':
            imageUrl = data.message;
            break;
          case 'cat':
            imageUrl = data[0].url;
            break;
          case 'fox':
            imageUrl = data.image;
            break;
          case 'red_panda':
          case 'panda':
            imageUrl = data.image;
            break;
        }

        if (!imageUrl) {
          throw new Error('No image URL found in API response');
        }

        const embed = new EmbedBuilder()
          .setTitle(`🐾 Random ${animalName}`)
          .setImage(imageUrl)
          .setColor(config.embedColor)
          .setFooter({ 
            text: `Requested by ${interaction.user.tag}`,
            iconURL: interaction.user.displayAvatarURL()
          })
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });

      } catch (error) {
        console.error('Image fetch error:', error);
        
        const errorEmbed = new EmbedBuilder()
          .setTitle('❌ Error')
          .setDescription('Failed to fetch animal image. Please try again later.')
          .setColor('#ff0000')
          .setTimestamp();

        await interaction.editReply({ embeds: [errorEmbed] });
      }
    }
  }
};
