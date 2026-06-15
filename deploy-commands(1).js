// =============================================================
//  deploy-commands.js — Seine Bot
//  Run ONCE: node deploy-commands.js
// =============================================================

const { REST, Routes } = require('discord.js');
const config = require('./config.json');

const commands = [
  // DBD COMMANDS
  { name: 'perk',         description: 'Get info on a DBD perk + icon', options: [{ type: 3, name: 'name', description: 'Perk name e.g. dead hard, bbq, corrupt intervention', required: true }] },
  { name: 'killer',       description: 'Get info on a DBD killer', options: [{ type: 3, name: 'name', description: 'Killer name e.g. nurse, blight, spirit', required: true }] },
  { name: 'randomkiller', description: 'Get a random killer to play tonight' },
  { name: 'tracker',      description: 'Look up a player\'s DBD stats', options: [{ type: 3, name: 'username', description: 'Your Steam or Epic username', required: true }] },
  { name: 'shrine',       description: 'Info about the current Shrine of Secrets' },
  { name: 'build',        description: 'Get a recommended DBD build', options: [{ type: 3, name: 'side', description: 'Survivor or Killer', required: true, choices: [{ name: 'Survivor', value: 'survivor' }, { name: 'Killer', value: 'killer' }] }] },
  { name: 'dbd-rules',    description: 'Post the DBD community rules', default_member_permissions: '8192' },
  // MODERATION
  { name: 'ban',           description: 'Ban a member', default_member_permissions: '4', options: [{ type: 6, name: 'user', description: 'User to ban', required: true }, { type: 3, name: 'reason', description: 'Reason', required: false }, { type: 4, name: 'delete_days', description: 'Days of messages to delete', required: false, min_value: 0, max_value: 7 }] },
  { name: 'kick',          description: 'Kick a member', default_member_permissions: '2', options: [{ type: 6, name: 'user', description: 'User to kick', required: true }, { type: 3, name: 'reason', description: 'Reason', required: false }] },
  { name: 'timeout',       description: 'Timeout a member', default_member_permissions: '1099511627776', options: [{ type: 6, name: 'user', description: 'User', required: true }, { type: 3, name: 'duration', description: 'Duration e.g. 10m 1h 1d', required: true }, { type: 3, name: 'reason', description: 'Reason', required: false }] },
  { name: 'untimeout',     description: 'Remove timeout', default_member_permissions: '1099511627776', options: [{ type: 6, name: 'user', description: 'User', required: true }] },
  { name: 'warn',          description: 'Warn a member', default_member_permissions: '1099511627776', options: [{ type: 6, name: 'user', description: 'User', required: true }, { type: 3, name: 'reason', description: 'Reason', required: true }] },
  { name: 'warnings',      description: 'View warnings for a member', default_member_permissions: '1099511627776', options: [{ type: 6, name: 'user', description: 'User', required: true }] },
  { name: 'clearwarnings', description: 'Clear warnings for a member', default_member_permissions: '1099511627776', options: [{ type: 6, name: 'user', description: 'User', required: true }] },
  { name: 'purge',         description: 'Bulk delete messages', default_member_permissions: '8192', options: [{ type: 4, name: 'amount', description: 'Amount (1-100)', required: true, min_value: 1, max_value: 100 }, { type: 6, name: 'user', description: 'Only from this user', required: false }] },
  { name: 'unban',         description: 'Unban a user by ID', default_member_permissions: '4', options: [{ type: 3, name: 'userid', description: 'User ID', required: true }] },
  { name: 'lock',          description: 'Lock a channel', default_member_permissions: '8192', options: [{ type: 7, name: 'channel', description: 'Channel (defaults to current)', required: false }, { type: 3, name: 'reason', description: 'Reason', required: false }] },
  { name: 'unlock',        description: 'Unlock a channel', default_member_permissions: '8192', options: [{ type: 7, name: 'channel', description: 'Channel', required: false }] },
  { name: 'slowmode',      description: 'Set slowmode', default_member_permissions: '8192', options: [{ type: 4, name: 'seconds', description: 'Seconds (0 to disable)', required: true, min_value: 0, max_value: 21600 }, { type: 7, name: 'channel', description: 'Channel', required: false }] },
  { name: 'giverole',      description: 'Give a role to a user', default_member_permissions: '268435456', options: [{ type: 6, name: 'user', description: 'User', required: true }, { type: 8, name: 'role', description: 'Role', required: true }] },
  { name: 'removerole',    description: 'Remove a role from a user', default_member_permissions: '268435456', options: [{ type: 6, name: 'user', description: 'User', required: true }, { type: 8, name: 'role', description: 'Role', required: true }] },
  { name: 'nick',          description: "Change a member's nickname", default_member_permissions: '67108864', options: [{ type: 6, name: 'user', description: 'User', required: true }, { type: 3, name: 'nickname', description: 'New nickname (empty to reset)', required: false }] },
  // UTILITY
  { name: 'userinfo',    description: 'Get info about a user', options: [{ type: 6, name: 'user', description: 'User', required: false }] },
  { name: 'serverinfo',  description: 'Get info about the server' },
  { name: 'avatar',      description: "Get a user's avatar", options: [{ type: 6, name: 'user', description: 'User', required: false }] },
  { name: 'rank',        description: 'Check XP rank', options: [{ type: 6, name: 'user', description: 'User', required: false }] },
  { name: 'leaderboard', description: 'View XP leaderboard' },
  { name: 'poll',        description: 'Create a poll', options: [{ type: 3, name: 'question', description: 'Question', required: true }, { type: 3, name: 'option1', description: 'Option 1', required: false }, { type: 3, name: 'option2', description: 'Option 2', required: false }, { type: 3, name: 'option3', description: 'Option 3', required: false }, { type: 3, name: 'option4', description: 'Option 4', required: false }] },
  { name: 'announce',    description: 'Send announcement', default_member_permissions: '8192', options: [{ type: 3, name: 'title', description: 'Title', required: true }, { type: 3, name: 'message', description: 'Message', required: true }, { type: 7, name: 'channel', description: 'Channel', required: false }, { type: 3, name: 'ping', description: 'Ping', required: false, choices: [{ name: '@everyone', value: 'everyone' }, { name: '@here', value: 'here' }, { name: 'No ping', value: 'none' }] }] },
  { name: 'say',         description: 'Make the bot say something', default_member_permissions: '8192', options: [{ type: 3, name: 'message', description: 'Message', required: true }, { type: 7, name: 'channel', description: 'Channel', required: false }] },
  { name: 'remind',      description: 'Set a reminder', options: [{ type: 3, name: 'time', description: 'Time e.g. 10m 1h 2d', required: true }, { type: 3, name: 'message', description: 'Reminder message', required: true }] },
  { name: '8ball',       description: 'Ask the magic 8-ball', options: [{ type: 3, name: 'question', description: 'Your question', required: true }] },
  { name: 'coinflip',    description: 'Flip a coin' },
  { name: 'afk',        description: 'Set AFK status', options: [{ type: 3, name: 'reason', description: 'Reason', required: false }] },
  { name: 'help',        description: 'List all commands' },
  // BIRTHDAY
  { name: 'birthday', description: 'Birthday system', options: [{ type: 1, name: 'set', description: 'Set your birthday', options: [{ type: 4, name: 'day', description: 'Day (1-31)', required: true, min_value: 1, max_value: 31 }, { type: 4, name: 'month', description: 'Month (1-12)', required: true, min_value: 1, max_value: 12 }] }, { type: 1, name: 'remove', description: 'Remove your birthday' }, { type: 1, name: 'check', description: "Check someone's birthday", options: [{ type: 6, name: 'user', description: 'User', required: false }] }, { type: 1, name: 'list', description: 'List all birthdays' }] },
  // MUSIC
  { name: 'play',       description: 'Play a song', options: [{ type: 3, name: 'query', description: 'Song name or URL', required: true }] },
  { name: 'skip',       description: 'Skip current song' },
  { name: 'stop',       description: 'Stop music' },
  { name: 'queue',      description: 'View music queue' },
  { name: 'pause',      description: 'Pause music' },
  { name: 'resume',     description: 'Resume music' },
  { name: 'nowplaying', description: 'Currently playing' },
  { name: 'volume',     description: 'Set volume', options: [{ type: 4, name: 'level', description: 'Volume (1-100)', required: true, min_value: 1, max_value: 100 }] },
  { name: 'shuffle',    description: 'Shuffle queue' },
  // SETUP
  { name: 'setup-verify',     description: 'Post verification panel', default_member_permissions: '8' },
  { name: 'setup-roles',      description: 'Post role selection menu', default_member_permissions: '8' },
  { name: 'setup-ticket',     description: 'Post ticket panel', default_member_permissions: '8' },
  { name: 'setup-perms',      description: 'Auto-configure channel permissions', default_member_permissions: '8' },
  { name: 'add-role-option',  description: 'Add role to role menu', default_member_permissions: '8', options: [{ type: 8, name: 'role', description: 'Role', required: true }, { type: 3, name: 'emoji', description: 'Emoji', required: false }, { type: 3, name: 'description', description: 'Description', required: false }] },
  { name: 'add-streamer',     description: 'Track a Twitch streamer', default_member_permissions: '8', options: [{ type: 3, name: 'username', description: 'Twitch username', required: true }] },
  { name: 'remove-streamer',  description: 'Stop tracking a streamer', default_member_permissions: '8', options: [{ type: 3, name: 'username', description: 'Twitch username', required: true }] }
];

const rest = new REST({ version: '10' }).setToken(config.token);

(async () => {
  try {
    console.log(`Registering ${commands.length} slash commands globally...`);
    await rest.put(Routes.applicationCommands(config.clientId), { body: commands });
    console.log('✅ All commands registered! Run: node index.js');
  } catch (err) {
    console.error('❌ Error:', err);
  }
})();
