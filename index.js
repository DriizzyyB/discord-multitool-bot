
const { Client, GatewayIntentBits, Collection, REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const cron = require('cron');
const config = require('./config.js');

// Initialize bot
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Command collection
client.commands = new Collection();
const commandFolders = fs.readdirSync(path.join(__dirname, 'commands'));

for (const folder of commandFolders) {
  const commandFiles = fs.readdirSync(path.join(__dirname, 'commands', folder)).filter(file => file.endsWith('.js'));
  for (const file of commandFiles) {
    const command = require(`./commands/${folder}/${file}`);
    if (command.data && command.data.name) {
      client.commands.set(command.data.name, command);
    } else {
      console.log(`Skipping invalid command file: ${file}`);
    }
  }
}

// REST API for registering commands
const rest = new REST({ version: '10' }).setToken(config.bot.token);

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);

  // Register slash commands
  try {
    const commands = client.commands.map((cmd) => cmd.data.toJSON());
    await rest.put(
      Routes.applicationGuildCommands(config.bot.clientId, config.bot.guildId),
      { body: commands },
    );
    console.log('Successfully registered application commands.');
  } catch (error) {
    console.error(error);
  }
});

// Handle slash commands
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isCommand()) return;
  const command = client.commands.get(interaction.commandName);

  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);
    await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
  }
});

// Scheduled task to send updates from FiveM
const { scheduleUpdate } = require('./tasks/scheduledUpdate');
const updateInterval = config.fivem.updateInterval || 30;  
const updateJob = new cron.CronJob(`*/${updateInterval} * * * *`, () => scheduleUpdate(client));
updateJob.start();

client.login(config.bot.token);
