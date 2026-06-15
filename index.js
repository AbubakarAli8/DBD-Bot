// =============================================================
//  SEINE BOT — Dead by Daylight Discord Bot
//  All-in-one: DBD commands + Full moderation + Community features
// =============================================================

const {
  Client, GatewayIntentBits, Partials, Collection,
  EmbedBuilder, PermissionFlagsBits, ActionRowBuilder,
  ButtonBuilder, ButtonStyle, StringSelectMenuBuilder,
  ChannelType, Events
} = require('discord.js');

const { Player } = require('discord-player');
const fetch = require('node-fetch');
const fs   = require('fs');
const path = require('path');

// =============================================================
//  CONFIG
// =============================================================

let config;
try {
  config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
} catch {
  config = {
    token:    process.env.TOKEN,
    clientId: process.env.CLIENT_ID,
    guildId:  process.env.GUILD_ID,
    channels: {
      auditLogs:    process.env.AUDIT_LOGS_CHANNEL || '',
      modLogs:      process.env.MOD_LOGS_CHANNEL   || '',
      welcome:      process.env.WELCOME_CHANNEL     || '',
      verify:       process.env.VERIFY_CHANNEL      || '',
      roles:        process.env.ROLES_CHANNEL       || '',
      streamAlerts: process.env.STREAM_ALERTS_CHANNEL || '',
    },
    roles: {
      verified: process.env.VERIFIED_ROLE || '',
      autoRole: process.env.AUTO_ROLE     || '',
      mod:      process.env.MOD_ROLE      || '',
    },
    twitch: { clientId: '', clientSecret: '', streamers: [] },
    automod: { bannedWords: [], antiInvite: true, antiSpam: true, antiCaps: true, capsThreshold: 70 },
    leveling: { xpPerMessage: 15, xpCooldown: 60 }
  };
}

// =============================================================
//  DATA
// =============================================================

const DATA = './data';
if (!fs.existsSync(DATA)) fs.mkdirSync(DATA);
function load(f)       { const p = path.join(DATA,f); if(!fs.existsSync(p)) fs.writeFileSync(p,'{}'); return JSON.parse(fs.readFileSync(p,'utf8')); }
function save(f,d)     { fs.writeFileSync(path.join(DATA,f), JSON.stringify(d,null,2)); }

let warnings   = load('warnings.json');
let levels     = load('levels.json');
let roleMenus  = load('role-menus.json');
let twitchLive = load('twitch-live.json');
let ticketData = load('tickets.json');
let birthdays  = load('birthdays.json');
let afkUsers   = load('afk.json');

// =============================================================
//  CLIENT
// =============================================================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildMessageReactions, GatewayIntentBits.GuildPresences
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.GuildMember, Partials.User]
});

const player    = new Player(client, { skipFFmpeg: false });
const spamTrack = new Map();
const xpCooldown= new Map();
const vcJoinTime= new Map();

// =============================================================
//  COLOURS — Orange + Purple DBD theme
// =============================================================

const C = {
  orange:  0xFF6600,
  purple:  0x7B2FBE,
  red:     0xED4245,
  green:   0x57F287,
  yellow:  0xFEE75C,
  grey:    0x99AAB5,
  blood:   0x8B0000,
  fog:     0x2C2C3A
};

// =============================================================
//  DBD PERK DATABASE
// =============================================================

const DBD_PERKS = {
  // ── TOP SURVIVOR PERKS ──────────────────────────────────────
  'dead hard': {
    name: 'Dead Hard', type: 'Survivor', character: 'David King',
    description: 'When Injured, press the Active Ability button to dash forward and gain Endurance for the duration. After use, suffer Exhausted for 40/35/30 seconds. Cannot be used while Exhausted.',
    tier: '🏆 S Tier', tip: 'Time it perfectly to avoid a hit at a pallet or window. One of the strongest survivor perks in DBD.',
    icon: 'https://deadbydaylight.wiki.gg/wiki/Special:FilePath/IconPerks_deadHard.png'
  },
  'sprint burst': {
    name: 'Sprint Burst', type: 'Survivor', character: 'Meg Thomas',
    description: 'When you start running, break into a sprint at 150% of your normal running speed for 3 seconds. Suffer the Exhausted status for 60/50/40 seconds after use.',
    tier: '🥈 A Tier', tip: 'Great for creating distance immediately. Pair with Windows of Opportunity.',
    icon: 'https://deadbydaylight.wiki.gg/wiki/Special:FilePath/IconPerks_sprintBurst.png'
  },
  'adrenaline': {
    name: 'Adrenaline', type: 'Survivor', character: 'Meg Thomas',
    description: 'When the Exit Gates are powered, instantly heal one Health State and sprint at 150% speed for 5 seconds. This perk is on hold if you are hooked at the time of activation.',
    tier: '🏆 S Tier', tip: 'End-game monster perk. Always useful — the speed boost can save you in the last seconds.',
    icon: 'https://deadbydaylight.wiki.gg/wiki/Special:FilePath/IconPerks_adrenaline.png'
  },
  'ds': {
    name: 'Decisive Strike', type: 'Survivor', character: 'Laurie Strode',
    description: 'After being unhooked or unhooking yourself, Decisive Strike activates for 60 seconds. While active, if the Killer grabs you, stun them for 5 seconds and escape their grasp.',
    tier: '🏆 S Tier', tip: 'Essential anti-tunnel perk. Always run this if the killer is tunnelling you.',
    icon: 'https://deadbydaylight.wiki.gg/wiki/Special:FilePath/IconPerks_decisiveStrike.png'
  },
  'decisive strike': {
    name: 'Decisive Strike', type: 'Survivor', character: 'Laurie Strode',
    description: 'After being unhooked or unhooking yourself, Decisive Strike activates for 60 seconds. While active, if the Killer grabs you, stun them for 5 seconds and escape their grasp.',
    tier: '🏆 S Tier', tip: 'Essential anti-tunnel perk. Always run this if the killer is tunnelling you.',
    icon: 'https://deadbydaylight.wiki.gg/wiki/Special:FilePath/IconPerks_decisiveStrike.png'
  },
  'off the record': {
    name: 'Off the Record', type: 'Survivor', character: 'Zarina Kassir',
    description: 'After being unhooked, gain the Endurance status and suppressed grunts of pain for 60/70/80 seconds. Deactivates when you damage a Generator.',
    tier: '🏆 S Tier', tip: 'The best anti-tunnel perk in the game. Pairs perfectly with DS for complete tunnel protection.',
    icon: 'https://deadbydaylight.wiki.gg/wiki/Special:FilePath/IconPerks_offTheRecord.png'
  },
  'iron will': {
    name: 'Iron Will', type: 'Survivor', character: 'Jake Park',
    description: 'Suppresses grunts of pain caused by injuries by 50/75/100%.',
    tier: '🥈 A Tier', tip: 'Makes you silent while injured. Great for hiding from the killer while wounded.',
    icon: 'https://deadbydaylight.wiki.gg/wiki/Special:FilePath/IconPerks_ironWill.png'
  },
  'windows of opportunity': {
    name: 'Windows of Opportunity', type: 'Survivor', character: 'Kate Denson',
    description: 'Auras of Pallets, Breakable Walls, and Windows are revealed within 24/28/32 metres. This perk has a 30-second cooldown.',
    tier: '🏆 S Tier', tip: 'Best information perk for survivors. Shows you where all pallets and windows are — essential for beginners.',
    icon: 'https://deadbydaylight.wiki.gg/wiki/Special:FilePath/IconPerks_windowsOfOpportunity.png'
  },
  'borrowed time': {
    name: 'Borrowed Time', type: 'Survivor', character: 'Bill Overbeck',
    description: 'When unhooking a Survivor within the Killer\'s Terror Radius, the unhooked Survivor benefits from the Endurance status effect for 6/8/10 seconds.',
    tier: '🏆 S Tier', tip: 'Essential for risky unhooks under the killer\'s nose. Always run in solo queue.',
    icon: 'https://deadbydaylight.wiki.gg/wiki/Special:FilePath/IconPerks_borrowedTime.png'
  },
  'bt': {
    name: 'Borrowed Time', type: 'Survivor', character: 'Bill Overbeck',
    description: 'When unhooking a Survivor within the Killer\'s Terror Radius, the unhooked Survivor benefits from the Endurance status effect for 6/8/10 seconds.',
    tier: '🏆 S Tier', tip: 'Essential for risky unhooks under the killer\'s nose. Always run in solo queue.',
    icon: 'https://deadbydaylight.wiki.gg/wiki/Special:FilePath/IconPerks_borrowedTime.png'
  },
  'kindred': {
    name: 'Kindred', type: 'Survivor', character: 'General (Universal)',
    description: 'When you are hooked, all Survivors\' auras are revealed to each other. Additionally, the Killer\'s aura is revealed to all Survivors within 8/12/16 metres of your Hook.',
    tier: '🏆 S Tier', tip: 'Best information perk in the game. Makes coordination easy even in solo queue. Always run this.',
    icon: 'https://deadbydaylight.wiki.gg/wiki/Special:FilePath/IconPerks_kindred.png'
  },
  'lithe': {
    name: 'Lithe', type: 'Survivor', character: 'Feng Min',
    description: 'After performing a rushed vault, break into a sprint at 150% for 3 seconds. Suffer Exhausted for 60/50/40 seconds after use.',
    tier: '🥈 A Tier', tip: 'Great for vaulting through windows. Pairs well with maps that have lots of windows.',
    icon: 'https://deadbydaylight.wiki.gg/wiki/Special:FilePath/IconPerks_lithe.png'
  },
  'self care': {
    name: 'Self Care', type: 'Survivor', character: 'Claudette Morel',
    description: 'Unlocks the ability to heal yourself without a Med-Kit at 50% of the normal Healing speed. Increases the efficiency of Med-Kit self-heals by 10/15/20%.',
    tier: '🥉 C Tier', tip: 'Heavily outclassed in 2026. Takes too long — use Botany Knowledge or a better perk instead.',
    icon: 'https://deadbydaylight.wiki.gg/wiki/Special:FilePath/IconPerks_selfCare.png'
  },
  'we ll make it': {
    name: "We'll Make It", type: 'Survivor', character: 'General (Universal)',
    description: "After unhooking a Survivor, gain a 100% bonus to healing speed for 90 seconds.",
    tier: '🥈 A Tier', tip: 'Great if you\'re the team healer. Very fast heals after unhooks.',
    icon: "https://deadbydaylight.wiki.gg/wiki/Special:FilePath/IconPerks_we'llMakeIt.png"
  },
  'boon circle of healing': {
    name: 'Boon: Circle of Healing', type: 'Survivor', character: 'Mikaela Reid',
    description: 'Press and hold the Active Ability button near a Dull or Hex Totem to bless it. Survivors within 24 metres can self-heal at 90% speed and gain 40/45/50% healing speed bonus.',
    tier: '🏆 S Tier', tip: 'One of the strongest boon perks. Set it up in a central location for maximum value.',
    icon: 'https://deadbydaylight.wiki.gg/wiki/Special:FilePath/IconPerks_boonCircleOfHealing.png'
  },
  'sabo': {
    name: 'Saboteur', type: 'Survivor', character: 'Jake Park',
    description: 'Unlocks the ability to sabotage Hook without a Toolbox. Sabotaging a Hook takes 2.5/2/1.5 seconds and causes the Hook to collapse for 90 seconds.',
    tier: '🥉 B Tier', tip: 'Fun but situational. Pair with Breakdown for longer sabotage time.',
    icon: 'https://deadbydaylight.wiki.gg/wiki/Special:FilePath/IconPerks_saboteur.png'
  },
  // ── TOP KILLER PERKS ────────────────────────────────────────
  'bbq': {
    name: 'BBQ & Chili', type: 'Killer', character: 'The Cannibal',
    description: 'After hooking a Survivor, all other Survivors\' auras are revealed for 4 seconds when they are farther than 40 metres from the Hook. Gain a 100% bonus to Bloodpoints from all Actions.',
    tier: '🏆 S Tier', tip: 'Essential for BP and information. Run this on every killer every game.',
    icon: 'https://deadbydaylight.wiki.gg/wiki/Special:FilePath/IconPerks_barbequeAndChilli.png'
  },
  'pop goes the weasel': {
    name: 'Pop Goes the Weasel', type: 'Killer', character: 'The Clown',
    description: 'After hooking a Survivor, for the next 40/50/60 seconds, the next Generator you kick loses an additional 25% of its current progress.',
    tier: '🏆 S Tier', tip: 'Best gen regression perk in the game. Hook → kick gen. Simple and devastating.',
    icon: 'https://deadbydaylight.wiki.gg/wiki/Special:FilePath/IconPerks_popGoesTheWeasel.png'
  },
  'pop': {
    name: 'Pop Goes the Weasel', type: 'Killer', character: 'The Clown',
    description: 'After hooking a Survivor, for the next 40/50/60 seconds, the next Generator you kick loses an additional 25% of its current progress.',
    tier: '🏆 S Tier', tip: 'Best gen regression perk in the game. Hook → kick gen. Simple and devastating.',
    icon: 'https://deadbydaylight.wiki.gg/wiki/Special:FilePath/IconPerks_popGoesTheWeasel.png'
  },
  'corrupt intervention': {
    name: 'Corrupt Intervention', type: 'Killer', character: 'The Plague',
    description: 'At the start of the Trial, the 3 Generators located farthest from you are blocked by The Entity and cannot be repaired for 120 seconds. This perk deactivates when you hook a Survivor.',
    tier: '🏆 S Tier', tip: 'Gives you free map pressure at the start of every game. Run this on every killer.',
    icon: 'https://deadbydaylight.wiki.gg/wiki/Special:FilePath/IconPerks_corruptIntervention.png'
  },
  'corrupt': {
    name: 'Corrupt Intervention', type: 'Killer', character: 'The Plague',
    description: 'At the start of the Trial, the 3 Generators located farthest from you are blocked by The Entity and cannot be repaired for 120 seconds.',
    tier: '🏆 S Tier', tip: 'Gives you free map pressure at the start. Run on every killer.',
    icon: 'https://deadbydaylight.wiki.gg/wiki/Special:FilePath/IconPerks_corruptIntervention.png'
  },
  'bamboozle': {
    name: 'Bamboozle', type: 'Killer', character: 'The Clown',
    description: 'Vaulting speed is increased by 5/10/15%. Survivors cannot vault a Window that you have just vaulted for 8/12/16 seconds.',
    tier: '🥈 A Tier', tip: 'Great at loops — vault a window to block it and cut survivors off.',
    icon: 'https://deadbydaylight.wiki.gg/wiki/Special:FilePath/IconPerks_bamboozle.png'
  },
  'nowhere to hide': {
    name: 'Nowhere to Hide', type: 'Killer', character: 'The Unknown',
    description: 'After kicking a Generator, the auras of all Survivors within 24 metres are revealed for 3/4/5 seconds.',
    tier: '🏆 S Tier', tip: 'Incredible information perk. Kick a gen and immediately see nearby survivors.',
    icon: 'https://deadbydaylight.wiki.gg/wiki/Special:FilePath/IconPerks_nowhereToHide.png'
  },
  'pain resonance': {
    name: 'Pain Resonance', type: 'Killer', character: 'The Artist',
    description: 'Gains 4 Tokens at the start of the Trial. Each time you hook a Survivor, consume a Token — the Generator with the most progress explodes and loses 15% progress, and survivors repairing it scream.',
    tier: '🏆 S Tier', tip: 'Best passive gen regression perk. Hook someone and automatically regress the most progressed gen. Pairs with Surge.',
    icon: 'https://deadbydaylight.wiki.gg/wiki/Special:FilePath/IconPerks_painResonance.png'
  },
  'hex no one escapes death': {
    name: 'Hex: No One Escapes Death', type: 'Killer', character: 'General (Universal)',
    description: 'Once the Exit Gates are powered, this Hex activates. Survivors suffer the Exposed status, and your Movement speed is increased by 2/3/4%.',
    tier: '🥈 A Tier', tip: 'One-shots injured survivors in end game. Very powerful but relies on the totem surviving.',
    icon: 'https://deadbydaylight.wiki.gg/wiki/Special:FilePath/IconPerks_hexNoOneEscapesDeath.png'
  },
  'noed': {
    name: 'Hex: No One Escapes Death', type: 'Killer', character: 'General (Universal)',
    description: 'Once the Exit Gates are powered, this Hex activates. Survivors suffer the Exposed status, and your Movement speed is increased by 2/3/4%.',
    tier: '🥈 A Tier', tip: 'One-shots injured survivors in end game. Cleanse totems early to counter it.',
    icon: 'https://deadbydaylight.wiki.gg/wiki/Special:FilePath/IconPerks_hexNoOneEscapesDeath.png'
  },
  'scourge hook pain resonance': {
    name: 'Pain Resonance', type: 'Killer', character: 'The Artist',
    description: 'Gains 4 Tokens. Each hook on a Scourge Hook triggers the most progressed Generator to explode, losing 15% progress.',
    tier: '🏆 S Tier', tip: 'Automatic gen regression on hooks. Pairs amazingly with Pop Goes the Weasel.',
    icon: 'https://deadbydaylight.wiki.gg/wiki/Special:FilePath/IconPerks_painResonance.png'
  },
  'lethal pursuer': {
    name: 'Lethal Pursuer', type: 'Killer', character: 'The Nemesis',
    description: 'At the start of the Trial, all Survivors\' auras are revealed for 9 seconds. Extends the duration of other Aura-revealing effects by 2 seconds.',
    tier: '🏆 S Tier', tip: 'See every survivor from the start. Great opener — rush the closest one.',
    icon: 'https://deadbydaylight.wiki.gg/wiki/Special:FilePath/IconPerks_lethalPursuer.png'
  },
  'friends till the end': {
    name: 'Friends Til the End', type: 'Killer', character: 'The Unknown',
    description: 'When the Obsession is hooked, a random other Survivor becomes the new Obsession and becomes Exposed for 12/14/16 seconds. Gain Tokens up to 2 and earn bonus BP.',
    tier: '🥈 A Tier', tip: 'Great for spreading pressure. The exposed effect on the new obsession can net surprise downs.',
    icon: 'https://deadbydaylight.wiki.gg/wiki/Special:FilePath/IconPerks_friendsTilTheEnd.png'
  },
  'gift of pain': {
    name: 'Gift of Pain', type: 'Killer', character: 'The Cenobite',
    description: 'After hooking a Survivor, inflict them with Hemorrhage and Mangled when they are unhooked. If they heal fully, they suffer a 5/7/9% repair speed penalty for the rest of the Trial.',
    tier: '🥈 A Tier', tip: 'Punishes healing. Makes survivors work harder for every heal in the match.',
    icon: 'https://deadbydaylight.wiki.gg/wiki/Special:FilePath/IconPerks_giftOfPain.png'
  },
  'tinkerer': {
    name: 'Tinkerer', type: 'Killer', character: 'The Hillbilly',
    description: 'When a Generator is 70% repaired, receive a Loud Noise notification and lose your Terror Radius for 12/14/16 seconds. This perk has a 40-second cooldown per Generator.',
    tier: '🥈 A Tier', tip: 'Great for ambushing survivors at near-complete gens. Pairs well with stealth killers.',
    icon: 'https://deadbydaylight.wiki.gg/wiki/Special:FilePath/IconPerks_tinkerer.png'
  },
  'hex devour hope': {
    name: 'Hex: Devour Hope', type: 'Killer', character: 'The Hag',
    description: 'Gain a Token each time a Survivor is rescued from a Hook 24+ metres away. At 2 Tokens: Exposed after chases. At 3: Movement speed boost. At 5: Moris available.',
    tier: '🥈 A Tier', tip: 'Incredibly powerful if the totem survives long enough. Prioritise protecting it.',
    icon: 'https://deadbydaylight.wiki.gg/wiki/Special:FilePath/IconPerks_hexDevourHope.png'
  }
};

// =============================================================
//  DBD KILLER DATABASE
// =============================================================

const DBD_KILLERS = {
  'trapper': { name: 'The Trapper', power: 'Bear Traps', tier: '🥉 C Tier (2026)', speed: '4.6 m/s', terror: '32m', description: 'Sets bear traps across the map to catch survivors. High skill ceiling but very map dependent. Struggles on maps with few natural spots for traps.', tip: 'Place traps at pallet drops and window vaults. The Swamp and Coldwind are your best maps.' },
  'wraith': { name: 'The Wraith', power: 'Wailing Bell', tier: '🥉 C Tier (2026)', speed: '4.6 m/s (4.0 cloaked)', terror: '32m', description: 'Becomes invisible by ringing a bell. Simple to learn but survivors hear the uncloak bell, giving warning. Largely outclassed in 2026 meta.', tip: 'Uncloak behind cover to ambush. Windstorm add-ons make him much better.' },
  'hillbilly': { name: 'The Hillbilly', power: 'Chainsaw', tier: '🏆 S Tier (2026)', speed: '4.6 m/s', terror: '32m', description: 'One of the strongest killers in 2026. The chainsaw sprint allows rapid map traversal and one-hit downs. High skill but incredible reward.', tip: 'Master the chainsaw turns. Overheat add-ons are top tier. Billy is a top pick for tournament play.' },
  'nurse': { name: 'The Nurse', power: 'Spencer\'s Last Breath (Blink)', tier: '🏆 S Tier (2026)', speed: '3.8 m/s', terror: '20m', description: 'The highest skill ceiling killer in DBD and arguably the strongest. Blinks through walls and obstacles, making loops meaningless. A mastered Nurse is nearly unstoppable.', tip: 'Hardest killer to master. Learn blink timing. At high skill, she\'s the best killer in the game. Base kit is S tier.' },
  'shape': { name: 'The Shape', power: 'Evil Within', tier: '🥈 A Tier (2026)', speed: '4.4 m/s (Tier 1)', terror: '0m (Tier 1)', description: 'Michael Myers stalks survivors to build power. At Tier 3 he is exposed and has a massive lunge. A fan favourite with good depth.', tip: 'Always hit Tier 3 before going for a down. PWYF (Play With Your Food) build is very satisfying.' },
  'hag': { name: 'The Hag', power: 'Blackened Catalyst', tier: '🥈 A Tier (2026)', speed: '4.4 m/s', terror: '20m', description: 'Plants trap runes that teleport her to survivors who trigger them. Map control specialist. Very strong on certain maps.', tip: 'Place traps near hooks and generators. Flash builds counter her — beware torches.' },
  'doctor': { name: 'The Doctor', power: 'Carter\'s Spark', tier: '🥈 A Tier (2026)', speed: '4.6 m/s', terror: '26m', description: 'Inflicts Madness on survivors, causing illusions, failed skill checks, and screams. Great counter to stealthy plays and information build.', tip: 'Use Madness to disrupt survivor concentration. Punishment of the Damned range is deceptively large.' },
  'huntress': { name: 'The Huntress', power: 'Hunting Hatchets', tier: '🥈 A Tier (2026)', speed: '4.4 m/s', terror: '40m', description: 'Throws hatchets at survivors. A fan favourite with high skill expression. Massive terror radius but devastating ranged attack.', tip: 'Aim for injured survivors. Lean into cover to throw accurately. Practice your aim in KYF.' },
  'cannibal': { name: 'The Cannibal', power: 'Bubba\'s Chainsaw', tier: '🥈 A Tier (2026)', speed: '4.6 m/s', terror: '24m', description: 'Like Hillbilly but stronger base kit. The chainsaw can clear multiple survivors in one rev. Best known as the BBQ & Chili perk bearer.', tip: 'Rev the chainsaw at pallet drops to break both the pallet and injure survivors. Insta-saw build is devastating.' },
  'nightmare': { name: 'The Nightmare (Freddy)', power: 'Dream Demon', tier: '🥈 A Tier (2026)', speed: '4.6 m/s', terror: '0m (asleep)', description: 'Puts survivors to sleep, making them unable to hear his terror radius. Creates Dream Pallets and Dream Snares. Greatly reworked in 2025 and much better now.', tip: 'Use Dream Pallets defensively. Keep survivors asleep as long as possible for maximum value.' },
  'spirit': { name: 'The Spirit', power: 'Yamaoka\'s Haunting', tier: '🏆 S Tier (2026)', speed: '4.4 m/s (4.6 phasing)', terror: '16m', description: 'Phases out and moves at high speed invisibly. Devastating at high skill — survivors cannot see her during phase and must guess her direction.', tip: 'Phase toward where survivors will go, not where they are. Add-ons that show scratch marks during phase are powerful.' },
  'legion': { name: 'The Legion', power: 'Feral Frenzy', tier: '🥉 C Tier (2026)', speed: '4.6 m/s', terror: '32m', description: 'Sprints and multi-hits survivors with Feral Frenzy, inflicting Deep Wound. Fun to play but one of the weakest killers in 2026 — no real map pressure.', tip: 'Best for beginners to learn the game. Laceration add-ons help. Do not expect to win against experienced survivors.' },
  'plague': { name: 'The Plague', power: 'Vile Purge', tier: '🥈 A Tier (2026)', speed: '4.6 m/s', terror: '32m', description: 'Infects survivors and the environment with her vomit. Survivors must cleanse infected pools to heal, but this powers up the Plague into Corrupt Purge one-shot vomit.', tip: 'Never use Corrupt Purge on pallets — waste it on a survivor directly. Let pools accumulate.' },
  'ghost face': { name: 'Ghost Face', power: 'Night Shroud', tier: '🥉 B Tier (2026)', speed: '4.6 m/s', terror: '0m (crouched)', description: 'Hides his terror radius while crouching and stalks survivors to expose them. Fun stealth killer but can be revealed by observant survivors.', tip: 'Stalk from unexpected angles. Pair with Lethal Pursuer for aggressive early game.' },
  'demogorgon': { name: 'The Demogorgon', power: 'Of the Abyss', tier: '🥈 A Tier (2026)', speed: '4.6 m/s', terror: '32m', description: 'Creates portals to teleport around the map and has a powerful lunge attack. Great map pressure and solid chasing ability.', tip: 'Place portals near gens and hooks. The lunge range is much larger than it looks.' },
  'oni': { name: 'The Oni', power: 'Yamaoka\'s Wrath', tier: '🏆 S Tier (2026)', speed: '4.4 m/s', terror: '32m', description: 'Absorbs blood orbs from injured survivors to charge his Demon power — a devastating high-speed demon dash. Snowballs incredibly hard.', tip: 'Injure everyone early, collect blood orbs, then unleash. Almost unstoppable when fully powered.' },
  'deathslinger': { name: 'The Deathslinger', power: 'The Redeemer', tier: '🥉 B Tier (2026)', speed: '4.4 m/s', terror: '24m', description: 'Shoots a chain to pull survivors toward him. A precision ranged killer — strong in the right hands but outclassed by other ranged options in 2026.', tip: 'Aim for running survivors not near cover. Corner shots are your best friend.' },
  'executioner': { name: 'The Executioner (Pyramid Head)', power: 'Rites of Judgement', tier: '🥈 A Tier (2026)', speed: '4.6 m/s', terror: '40m', description: 'Draws trails to inflict Torment, and can execute downed survivors with Punishment of the Damned. Cage of Atonement bypasses hook mechanics.', tip: 'Use trails to block survivor paths at loops. Cages bypass DS and BT — a strong anti-unhook mechanic.' },
  'blight': { name: 'The Blight', power: 'Blighted Corruption', tier: '🏆 S Tier (2026)', speed: '4.6 m/s', terror: '24m', description: 'Rushes at high speed with tokens and bounces off obstacles to attack. Top 3 killer in DBD — incredibly mobile, strong at loops, and rewards high skill.', tip: 'Learn bump angles. Compound 21 and Blighted Crow are the top add-on combo. Tournament-level pick.' },
  'twins': { name: 'The Twins', power: 'Blood Bond', tier: '🥉 C Tier (2026)', speed: '4.6 m/s', terror: '32m', description: 'Charlotte and Victor — Victor can be launched to chase survivors independently. Niche but can be devastating with the right setup.', tip: 'Proxy camp with Victor while Charlotte patrols. One of the hardest killers to master well.' },
  'trickster': { name: 'The Trickster', power: 'Showstopper', tier: '🥉 C Tier (2026)', speed: '4.6 m/s', terror: '32m', description: 'Throws knives to build lacerations — enough triggers a Main Event, allowing rapid fire knife throws. Fun concept but struggles against good looping survivors.', tip: 'Prioritise injured survivors for quick laceration buildup. Iridescent Film and Trick Top Hat are best add-ons.' },
  'nemesis': { name: 'The Nemesis', power: 'T-Virus', tier: '🥈 A Tier (2026)', speed: '4.6 m/s', terror: '32m', description: 'Infects survivors with his tentacle strike through pallets and walls. Zombies roam the map and add unpredictable pressure.', tip: 'Use the tentacle to contaminate through pallets before breaking them. Let zombies do free work.' },
  'cenobite': { name: 'The Cenobite (Pinhead)', power: 'Summons of Pain', tier: '🥈 A Tier (2026)', speed: '4.6 m/s', terror: '32m', description: 'Controls the Lament Configuration and sends chains to bind survivors. Can teleport to the box for strong pressure.', tip: 'Always grab the box yourself to get free teleports. Chains of Anguish add-on is S tier.' },
  'artist': { name: 'The Artist', power: 'Birds of Torment', tier: '🥈 A Tier (2026)', speed: '4.6 m/s', terror: '24m', description: 'Sends crows to attack survivors — they can be sent through walls. Strong pseudo-ranged killer with excellent gen regression via Pain Resonance.', tip: 'Send birds just before a survivor runs around a corner. Combine with Pain Resonance for devastating pressure.' },
  'onryo': { name: 'The Onryō (Sadako)', power: 'Deluge of Fear', tier: '🥈 A Tier (2026)', speed: '4.4 m/s', terror: '0m (condemned)', description: 'Manifests from TVs and spreads Condemned status via cassettes. Unique map pressure via TV network. Reworked and much improved.', tip: 'Always be partially manifested for the passive condemned buildup. Iridescent Videotape is best add-on.' },
  'dredge': { name: 'The Dredge', power: 'Reign of Darkness', tier: '🏆 S Tier (2026)', speed: '4.6 m/s', terror: '28m', description: 'Teleports between lockers and has a powerful nightfall phase that blinds survivors. Very strong in 2026 meta with oppressive locker teleport pressure.', tip: 'Keep lockers spread across the map. Nightfall is incredibly strong — use it to snowball. One of the best killers in 2026.' },
  'mastermind': { name: 'The Mastermind (Wesker)', power: 'Uroboros Infection', tier: '🏆 S Tier (2026)', speed: '4.6 m/s', terror: '32m', description: 'Infects survivors and has a powerful dash that can grab them and slam them into walls. Incredibly strong and fluid to play — consistently top tier.', tip: 'Aim slams into walls and obstacles for double the damage. One of the smoothest and strongest killers in the game.' },
  'knight': { name: 'The Knight', power: 'Guardia Compagnia', tier: '🥉 B Tier (2026)', speed: '4.6 m/s', terror: '32m', description: 'Summons AI guards to patrol areas and chase survivors. Unique gen pressure but guards can be unreliable and the power is complex.', tip: 'Use Carnifex guard for gen patrol. Place guards at strong loops to force survivors out.' },
  'skull merchant': { name: 'The Skull Merchant', power: 'Cyber Scan', tier: '🥉 C Tier (2026)', speed: '4.6 m/s', terror: '32m', description: 'Places drones to scan survivors and apply Deep Wounds. Controversial in the community for camping playstyles. Drones can lock down areas effectively.', tip: 'Place drones to cover your most important generators. One of the most disliked killers in the community.', controversy: '⚠️ Controversial — many communities ban tunnelling/camping with her' },
  'singularity': { name: 'The Singularity', power: 'BioMass Cannons', tier: '🥈 A Tier (2026)', speed: '4.6 m/s', terror: '32m', description: 'Infects survivors and objects with slipstreams, then teleports to slipstreamed locations. Unique and surprisingly powerful with practice.', tip: 'Overcharge survivors and teleport in for unexpected attacks. High skill ceiling but very rewarding.' },
  'xenomorph': { name: 'The Xenomorph', power: 'Crawling Darkness', tier: '🥈 A Tier (2026)', speed: '4.6 m/s', terror: '24m', description: 'Crawls in tunnels across the map for fast traversal, and has a powerful tail strike. Survivors can place turrets to counter. Strong map mobility.', tip: 'Use tunnels to cut off generators. Destroy turrets early before they become a problem.' },
  'unknown': { name: 'The Unknown', power: 'UVX', tier: '🏆 S Tier (2026)', speed: '4.6 m/s', terror: '32m', description: 'Fires a projectile that creates decoy hallucinations and can teleport to them. Has a unique deception mechanic. Top tier in 2026.', tip: 'Fire UVX around corners to create fake positions. Combine Nowhere to Hide and Friends Til the End for devastating info builds.' },
  'houndmaster': { name: 'The Houndmaster', power: 'Hound\'s Command', tier: '🥉 B Tier (2026)', speed: '4.4 m/s', terror: '32m', description: 'Commands a dog to sniff out and chase survivors. New addition to DBD — still being developed in the meta.', tip: 'Use the dog to flush survivors out of hiding spots and into your path.' }
};

// =============================================================
//  CLIENT SETUP
// =============================================================

const PREFIX = ',';

// =============================================================
//  COLOUR HELPERS
// =============================================================

function embed(opts = {}) {
  const e = new EmbedBuilder().setColor(opts.color ?? C.orange).setTimestamp();
  if (opts.title)       e.setTitle(opts.title);
  if (opts.description) e.setDescription(opts.description);
  if (opts.fields)      e.addFields(...opts.fields);
  if (opts.thumbnail)   e.setThumbnail(opts.thumbnail);
  if (opts.image)       e.setImage(opts.image);
  if (opts.footer)      e.setFooter(opts.footer);
  if (opts.author)      e.setAuthor(opts.author);
  return e;
}

function ch(guild, key, fallbackName) {
  const id = config.channels?.[key];
  return (id && guild.channels.cache.get(id)) || guild.channels.cache.find(c => c.name === fallbackName) || null;
}
async function logAudit(guild, emb) { const c = ch(guild,'auditLogs','audit-logs'); if(c) c.send({embeds:[emb]}).catch(()=>{}); }
async function logMod(guild, emb)   { const c = ch(guild,'modLogs','mod-logs');     if(c) c.send({embeds:[emb]}).catch(()=>{}); }

function parseTime(str) {
  const m = str?.match(/^(\d+)(s|m|h|d)$/i);
  if (!m) return null;
  return parseInt(m[1]) * { s:1e3, m:6e4, h:36e5, d:864e5 }[m[2].toLowerCase()];
}

// =============================================================
//  XP HELPERS
// =============================================================

function xpForLevel(lvl) { return 100 * lvl * lvl + 100 * lvl; }

// =============================================================
//  READY
// =============================================================

client.once(Events.ClientReady, async c => {
  console.log(`✅  ${c.user.tag} is ONLINE — Into the Fog 🩸`);
  c.user.setActivity('the fog 🩸', { type: 3 });

  const { DefaultExtractors } = require('@discord-player/extractor');
  await player.extractors.loadMulti(DefaultExtractors);
  console.log('🎵  Music extractors loaded');

  player.events.on('playerStart', (queue, track) => {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('music-pause').setLabel('⏸ Pause').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('music-skip').setLabel('⏭ Skip').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('music-stop').setLabel('⏹ Stop').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('music-queue').setLabel('📋 Queue').setStyle(ButtonStyle.Primary)
    );
    queue.metadata?.send({ embeds: [embed({ color: C.purple, title: '🎵 Now Playing', description: `**[${track.title}](${track.url})**`, thumbnail: track.thumbnail, fields: [{ name: '⏱️ Duration', value: track.duration, inline: true }, { name: '👤 Requested by', value: track.requestedBy?.tag || 'Unknown', inline: true }] })], components: [row] }).catch(()=>{});
  });
  player.events.on('emptyQueue', queue => { queue.metadata?.send({ embeds: [embed({ color: C.fog, description: '✅ Queue finished. Leaving voice channel.' })] }).catch(()=>{}); });
  player.events.on('playerError', (queue, error) => { console.error('[MUSIC ERROR]', error.message); });

  // Birthday checker
  async function checkBirthdays() {
    try {
      const now = new Date(), today = `${now.getMonth()+1}-${now.getDate()}`;
      for (const [userId, data] of Object.entries(birthdays)) {
        if (!data?.date || data.date !== today || data.announced === now.getFullYear()) continue;
        data.announced = now.getFullYear(); save('birthdays.json', birthdays);
        for (const [, guild] of client.guilds.cache) {
          const member = await guild.members.fetch(userId).catch(()=>null);
          if (!member) continue;
          const bdayCh = guild.channels.cache.find(c => c.name.includes('birthday') || c.name === 'general');
          if (bdayCh) bdayCh.send({ embeds: [embed({ color: C.orange, title: `🎂 Happy Birthday, ${member.user.username}!`, description: `Everyone wish ${member} a happy birthday! 🎉🎈`, thumbnail: member.user.displayAvatarURL({ dynamic: true }), footer: { text: `${guild.name} · Birthday System` } })] }).catch(()=>{});
        }
      }
    } catch (err) { console.error('[BIRTHDAY ERROR]', err.message); }
  }
  checkBirthdays(); setInterval(checkBirthdays, 3_600_000);

  // Member count channels
  async function updateStatChannels() {
    for (const [, guild] of client.guilds.cache) {
      try {
        await guild.members.fetch();
        const total = guild.memberCount;
        let statCat = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name === 'STATS');
        if (!statCat) {
          statCat = await guild.channels.create({ name: 'STATS', type: ChannelType.GuildCategory, permissionOverwrites: [{ id: guild.id, deny: ['Connect'] }] });
        }
        async function getStatCh(startsWith, newName) {
          let c = guild.channels.cache.find(c => c.type === ChannelType.GuildVoice && c.name.startsWith(startsWith) && c.parentId === statCat.id);
          if (!c) c = await guild.channels.create({ name: newName, type: ChannelType.GuildVoice, parent: statCat.id, permissionOverwrites: [{ id: guild.id, deny: ['Connect'] }] });
          return c;
        }
        const mCh = await getStatCh('Members:', `Members: ${total}`);
        const gCh = await getStatCh('Goal:', 'Goal: 9999');
        await mCh.setName(`Members: ${total}`).catch(()=>{});
        await gCh.setName('Goal: 9999').catch(()=>{});
      } catch (err) { console.error('[STAT CHANNELS]', err.message); }
    }
  }
  updateStatChannels(); setInterval(updateStatChannels, 600_000);

  // VC XP timer
  setInterval(async () => {
    for (const [guildId, guild] of client.guilds.cache) {
      for (const [, channel] of guild.channels.cache.filter(c => c.type === ChannelType.GuildVoice)) {
        for (const [, member] of channel.members) {
          if (member.user.bot) continue;
          const key = `${guildId}-${member.id}`;
          if (!levels[key]) levels[key] = { xp: 0, level: 0, userId: member.id, guildId };
          const old = levels[key].level;
          levels[key].xp += 50;
          let newLevel = 0, rem = levels[key].xp;
          while (rem >= xpForLevel(newLevel + 1)) { rem -= xpForLevel(newLevel + 1); newLevel++; }
          levels[key].level = newLevel;
          if (newLevel > old) {
            const lvlCh = guild.channels.cache.find(c => c.name === 'general');
            if (lvlCh) lvlCh.send({ embeds: [embed({ color: C.orange, title: '⬆️ Level Up!', description: `${member} reached **Level ${newLevel}** from voice activity! 🎤`, thumbnail: member.user.displayAvatarURL({ dynamic: true }) })] }).catch(()=>{});
          }
        }
        save('levels.json', levels);
      }
    }
  }, 600_000);

  // Twitch alerts
  if (config.twitch?.clientId) { setInterval(checkTwitch, 60_000); checkTwitch(); }
});

// =============================================================
//  MEMBER JOIN / LEAVE
// =============================================================

client.on(Events.GuildMemberAdd, async member => {
  if (config.roles?.autoRole) member.roles.add(config.roles.autoRole).catch(()=>{});

  const wch = ch(member.guild, 'welcome', 'welcome');
  if (wch) {
    wch.send({
      content: `Welcome ${member} to **${member.guild.name}**! 🩸`,
      embeds: [embed({
        color: C.orange,
        title: `🩸 A new Survivor has entered the Fog...`,
        description: `Welcome **${member.user.username}** to **${member.guild.name}**!\n\nThe Entity has been watching you. Now it's time to prove yourself — survive the trials, earn your place, and above all...\n\n**Don't get hooked.** 🪝`,
        fields: [
          { name: '📜 First Steps', value: 'Head to verify to unlock the server, then check the rules.', inline: false },
          { name: '🎭 Pick Your Roles', value: 'Visit the roles channel to show your playstyle and mains.', inline: false },
          { name: '👥 You are member', value: `#${member.guild.memberCount}`, inline: true },
          { name: '🩸 Good luck', value: 'Survivor 🙏', inline: true }
        ],
        thumbnail: member.user.displayAvatarURL({ dynamic: true }),
        footer: { text: `${member.guild.name} · Into the Fog`, iconURL: member.guild.iconURL() }
      })]
    }).catch(()=>{});
  }

  // Welcome DM
  member.user.send({ embeds: [embed({
    color: C.orange,
    title: `🩸 Welcome to ${member.guild.name}!`,
    description: `Hey ${member.user.username}! You've entered the fog. Here's how to get started:`,
    fields: [
      { name: '✅ Step 1 — Verify', value: 'Go to the verify channel and click the button to unlock the server.', inline: false },
      { name: '📜 Step 2 — Read the Rules', value: 'Check the rules channel — it\'s important.', inline: false },
      { name: '🎭 Step 3 — Grab Roles', value: 'Pick your killer/survivor mains and playstyle roles.', inline: false },
      { name: '💬 Step 4 — Say Hi', value: 'Jump into general — the community is friendly.', inline: false }
    ],
    footer: { text: `${member.guild.name} · Good luck in the fog 🩸` }
  })] }).catch(()=>{});

  logAudit(member.guild, embed({ color: C.green, title: '📥 Member Joined', fields: [{ name: 'User', value: `${member} (${member.id})`, inline: true }, { name: 'Account', value: `<t:${Math.floor(member.user.createdTimestamp/1000)}:R>`, inline: true }], thumbnail: member.user.displayAvatarURL({ dynamic: true }) }));
});

client.on(Events.GuildMemberRemove, member => {
  logAudit(member.guild, embed({ color: C.red, title: '📤 Member Left', fields: [{ name: 'User', value: `${member.user.tag} (${member.id})`, inline: true }, { name: 'Joined', value: member.joinedAt ? `<t:${Math.floor(member.joinedTimestamp/1000)}:R>` : 'Unknown', inline: true }] }));
});

client.on(Events.GuildBanAdd,    ban => logAudit(ban.guild, embed({ color: C.blood, title: '🔨 Member Banned',   fields: [{ name: 'User', value: `${ban.user.tag}`, inline: true }, { name: 'Reason', value: ban.reason || 'No reason', inline: true }] })));
client.on(Events.GuildBanRemove, ban => logAudit(ban.guild, embed({ color: C.green, title: '✅ Member Unbanned', fields: [{ name: 'User', value: `${ban.user.tag}`, inline: true }] })));

// =============================================================
//  ROLE / CHANNEL / VOICE LOGS
// =============================================================

client.on(Events.GuildRoleCreate, r  => logAudit(r.guild, embed({ color: C.green, title: '🎭 Role Created',  fields: [{ name: 'Role',  value: `${r}`, inline: true }] })));
client.on(Events.GuildRoleDelete, r  => logAudit(r.guild, embed({ color: C.red,   title: '🎭 Role Deleted',  fields: [{ name: 'Name',  value: r.name, inline: true }] })));
client.on(Events.ChannelCreate,   c  => { if(c.guild) logAudit(c.guild, embed({ color: C.green, title: '📁 Channel Created', fields: [{ name: 'Channel', value: `${c}`, inline: true }] })); });
client.on(Events.ChannelDelete,   c  => { if(c.guild) logAudit(c.guild, embed({ color: C.red,   title: '📁 Channel Deleted', fields: [{ name: 'Name', value: `#${c.name}`, inline: true }] })); });

client.on(Events.GuildMemberUpdate, (old, neo) => {
  const added = neo.roles.cache.filter(r => !old.roles.cache.has(r.id));
  const removed = old.roles.cache.filter(r => !neo.roles.cache.has(r.id));
  if (added.size || removed.size) {
    const fields = [{ name: 'Member', value: neo.user.tag, inline: false }];
    if (added.size)   fields.push({ name: '✅ Added',   value: added.map(r=>r.toString()).join(' '),   inline: false });
    if (removed.size) fields.push({ name: '❌ Removed', value: removed.map(r=>r.toString()).join(' '), inline: false });
    logAudit(neo.guild, embed({ color: C.purple, title: '👤 Roles Updated', fields }));
  }
});

client.on(Events.VoiceStateUpdate, async (old, neo) => {
  const member = neo.member || old.member;
  if (!member || member.user.bot) return;
  const key = `${neo.guild?.id}-${member.id}`;
  if (!old.channel && neo.channel) {
    vcJoinTime.set(key, Date.now());
    logAudit(neo.guild, embed({ color: C.green, title: '🔊 Joined VC', fields: [{ name: 'Member', value: member.user.tag, inline: true }, { name: 'Channel', value: neo.channel.name, inline: true }] }));
  } else if (old.channel && !neo.channel) {
    const joinTime = vcJoinTime.get(key);
    if (joinTime) {
      const mins = Math.floor((Date.now() - joinTime) / 60000);
      if (mins >= 1) {
        if (!levels[key]) levels[key] = { xp: 0, level: 0, userId: member.id, guildId: neo.guild.id };
        const old2 = levels[key].level;
        levels[key].xp += mins * 5;
        let newLevel = 0, rem = levels[key].xp;
        while (rem >= xpForLevel(newLevel + 1)) { rem -= xpForLevel(newLevel + 1); newLevel++; }
        levels[key].level = newLevel;
        save('levels.json', levels);
        if (newLevel > old2) {
          const lvlCh = neo.guild.channels.cache.find(c => c.name === 'general');
          if (lvlCh) lvlCh.send({ embeds: [embed({ color: C.orange, title: '⬆️ Level Up!', description: `${member} reached **Level ${newLevel}**! 🎤` })] }).catch(()=>{});
        }
      }
      vcJoinTime.delete(key);
    }
    logAudit(neo.guild, embed({ color: C.red, title: '🔇 Left VC', fields: [{ name: 'Member', value: member.user.tag, inline: true }, { name: 'Channel', value: old.channel.name, inline: true }] }));
  } else if (old.channel?.id !== neo.channel?.id) {
    vcJoinTime.set(key, Date.now());
    logAudit(neo.guild, embed({ color: C.purple, title: '🔀 Moved VC', fields: [{ name: 'Member', value: member.user.tag, inline: true }, { name: 'From', value: old.channel.name, inline: true }, { name: 'To', value: neo.channel.name, inline: true }] }));
  }
});

// =============================================================
//  MESSAGE EVENTS
// =============================================================

client.on(Events.MessageDelete, msg => {
  if (msg.author?.bot || !msg.guild) return;
  logAudit(msg.guild, embed({ color: C.yellow, title: '🗑️ Message Deleted', fields: [{ name: 'Author', value: `${msg.author?.tag ?? 'Unknown'}`, inline: true }, { name: 'Channel', value: `${msg.channel}`, inline: true }, { name: 'Content', value: msg.content?.substring(0,1000) || '*no content*', inline: false }] }));
});

client.on(Events.MessageUpdate, (old, neo) => {
  if (neo.author?.bot || !neo.guild || old.content === neo.content) return;
  logAudit(neo.guild, embed({ color: C.yellow, title: '✏️ Message Edited', fields: [{ name: 'Author', value: neo.author.tag, inline: true }, { name: 'Channel', value: `${neo.channel}`, inline: true }, { name: 'Before', value: old.content?.substring(0,500) || '*empty*', inline: false }, { name: 'After', value: neo.content?.substring(0,500) || '*empty*', inline: false }] }));
});

client.on(Events.MessageCreate, async msg => {
  if (msg.author.bot || !msg.guild) return;

  // AFK detection
  if (afkUsers[msg.author.id]) {
    delete afkUsers[msg.author.id]; save('afk.json', afkUsers);
    const m = await msg.channel.send({ embeds: [embed({ color: C.green, description: `👋 Welcome back ${msg.author}! AFK removed.` })] });
    setTimeout(() => m.delete().catch(()=>{}), 5000);
  }
  if (msg.mentions.users.size) {
    for (const [, u] of msg.mentions.users) {
      if (afkUsers[u.id]) {
        const { reason, time } = afkUsers[u.id];
        const ago = Math.floor((Date.now() - time) / 60000);
        const m = await msg.channel.send({ embeds: [embed({ color: C.yellow, description: `💤 **${u.username}** is AFK${reason ? ` — ${reason}` : ''}. (${ago < 1 ? 'just now' : `${ago}m ago`})` })] });
        setTimeout(() => m.delete().catch(()=>{}), 6000);
      }
    }
  }

  await autoMod(msg);
  await addXP(msg);
  await handlePrefix(msg);
});

// =============================================================
//  AUTO-MOD
// =============================================================

async function autoMod(msg) {
  const am = config.automod; if (!am) return;
  const member = msg.member;
  if (!member || member.permissions.has(PermissionFlagsBits.ManageMessages)) return;
  const warn = async txt => { await msg.delete().catch(()=>{}); const m = await msg.channel.send({ content: `${msg.author}, ${txt}` }); setTimeout(() => m.delete().catch(()=>{}), 5000); };
  if (am.bannedWords?.length && am.bannedWords.find(w => msg.content.toLowerCase().includes(w.toLowerCase()))) return warn('your message was removed for prohibited content.');
  if (am.antiInvite && /(discord\.gg|discord\.com\/invite)\/\S+/i.test(msg.content)) return warn('posting invite links is not allowed!');
  if (am.antiSpam) {
    const now = Date.now(), uid = msg.author.id;
    const d = spamTrack.get(uid) || { count: 0, last: 0, channel: null };
    if (now - d.last < 5000 && d.channel === msg.channel.id) { d.count++; if (d.count >= 5) { await member.timeout(60_000, 'AutoMod: spam').catch(()=>{}); msg.channel.send({ content: `${msg.author} timed out 1 min for spamming.` }); spamTrack.delete(uid); return; } } else { d.count = 1; }
    d.last = now; d.channel = msg.channel.id; spamTrack.set(uid, d);
  }
  if (am.antiCaps && msg.content.length > 10) { const letters = msg.content.replace(/[^a-zA-Z]/g,''); if (letters.length && (msg.content.replace(/[^A-Z]/g,'').length / letters.length) * 100 > (am.capsThreshold ?? 70)) return warn('please avoid excessive caps!'); }
}

// =============================================================
//  XP
// =============================================================

async function addXP(msg) {
  const lv = config.leveling; if (!lv?.xpPerMessage) return;
  const key = `${msg.guild.id}-${msg.author.id}`, now = Date.now();
  if (xpCooldown.has(key) && now - xpCooldown.get(key) < (lv.xpCooldown ?? 60) * 1000) return;
  xpCooldown.set(key, now);
  if (!levels[key]) levels[key] = { xp: 0, level: 0, userId: msg.author.id, guildId: msg.guild.id };
  const old = levels[key].level;
  levels[key].xp += Math.floor(Math.random() * 10) + lv.xpPerMessage;
  let newLevel = 0, rem = levels[key].xp;
  while (rem >= xpForLevel(newLevel + 1)) { rem -= xpForLevel(newLevel + 1); newLevel++; }
  levels[key].level = newLevel; save('levels.json', levels);
  if (newLevel > old) {
    const c = msg.channel;
    c.send({ embeds: [embed({ color: C.orange, title: '⬆️ Level Up!', description: `${msg.author} reached **Level ${newLevel}**! 🩸`, thumbnail: msg.author.displayAvatarURL({ dynamic: true }) })] }).catch(()=>{});
  }
}

// =============================================================
//  TWITCH
// =============================================================

let twitchToken = null, twitchExp = 0;
async function getTwitchToken() {
  if (twitchToken && Date.now() < twitchExp) return twitchToken;
  try { const r = await fetch(`https://id.twitch.tv/oauth2/token?client_id=${config.twitch.clientId}&client_secret=${config.twitch.clientSecret}&grant_type=client_credentials`, { method: 'POST' }); const d = await r.json(); twitchToken = d.access_token; twitchExp = Date.now() + d.expires_in * 1000 - 60_000; return twitchToken; } catch { return null; }
}
async function checkTwitch() {
  if (!config.twitch?.streamers?.length) return;
  const token = await getTwitchToken(); if (!token) return;
  for (const streamer of config.twitch.streamers) {
    try {
      const r = await fetch(`https://api.twitch.tv/helix/streams?user_login=${streamer}`, { headers: { 'Client-ID': config.twitch.clientId, 'Authorization': `Bearer ${token}` } });
      const stream = (await r.json()).data?.[0];
      const was = twitchLive[streamer];
      if (stream && !was) {
        twitchLive[streamer] = true; save('twitch-live.json', twitchLive);
        for (const [, guild] of client.guilds.cache) {
          const ac = ch(guild, 'streamAlerts', 'stream-alerts');
          if (ac) ac.send({ content: `@everyone 🔴 **${stream.user_name}** is live!`, embeds: [embed({ color: 0x9146FF, title: `🔴 ${stream.user_name} — ${stream.title}`, fields: [{ name: '🎮 Game', value: stream.game_name||'Unknown', inline: true }, { name: '👀 Viewers', value: stream.viewer_count.toString(), inline: true }], image: stream.thumbnail_url?.replace('{width}','1280').replace('{height}','720') })] }).catch(()=>{});
        }
      } else if (!stream && was) { twitchLive[streamer] = false; save('twitch-live.json', twitchLive); }
    } catch {}
  }
}

// =============================================================
//  INTERACTION ROUTER
// =============================================================

client.on(Events.InteractionCreate, async i => {
  try {
    if      (i.isChatInputCommand()) await handleCommand(i);
    else if (i.isButton())           await handleButton(i);
    else if (i.isStringSelectMenu()) await handleSelect(i);
  } catch (err) {
    console.error('[INTERACTION ERROR]', err.message);
    const r = { content: '❌ Something went wrong.', ephemeral: true };
    i.replied || i.deferred ? i.followUp(r).catch(()=>{}) : i.reply(r).catch(()=>{});
  }
});

// =============================================================
//  COMMAND HANDLER
// =============================================================

async function handleCommand(i) {
  const { commandName: cmd, guild, member, user } = i;

  // ── DBD PERK ─────────────────────────────────────────────────
  if (cmd === 'perk') {
    const input = i.options.getString('name').toLowerCase().trim();
    const perk  = DBD_PERKS[input] || Object.entries(DBD_PERKS).find(([k]) => k.includes(input) || input.includes(k))?.[1];
    if (!perk) {
      const wiki = `https://deadbydaylight.wiki.gg/wiki/${encodeURIComponent(i.options.getString('name').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('_'))}`;
      return i.reply({ embeds: [embed({ color: C.blood, title: '❌ Perk not found', description: `Couldn't find **${i.options.getString('name')}** in the database.\n\n🔗 [Search the DBD Wiki](${wiki})` })], ephemeral: true });
    }
    const typeColor = perk.type === 'Survivor' ? C.orange : C.blood;
    await i.reply({ embeds: [embed({
      color: typeColor,
      title: perk.name,
      thumbnail: perk.icon,
      fields: [
        { name: '👤 Type',      value: perk.type,      inline: true },
        { name: '🎮 Character', value: perk.character,  inline: true },
        { name: '🏆 Tier',      value: perk.tier,       inline: true },
        { name: '📋 Effect',    value: perk.description, inline: false },
        { name: '💡 Tip',       value: perk.tip,         inline: false }
      ],
      footer: { text: 'Dead by Daylight · Perk Info' }
    })] });
  }

  // ── DBD KILLER ───────────────────────────────────────────────
  else if (cmd === 'killer') {
    const input  = i.options.getString('name').toLowerCase().trim();
    const killer = DBD_KILLERS[input] || Object.entries(DBD_KILLERS).find(([k,v]) => k.includes(input) || v.name.toLowerCase().includes(input))?.[1];
    if (!killer) return i.reply({ embeds: [embed({ color: C.blood, title: '❌ Killer not found', description: `Try the exact killer name. e.g. \`nurse\`, \`blight\`, \`spirit\`, \`hillbilly\`` })], ephemeral: true });
    await i.reply({ embeds: [embed({
      color: C.blood,
      title: `🔪 ${killer.name}`,
      fields: [
        { name: '⚡ Power',     value: killer.power,       inline: true },
        { name: '🏆 Tier',      value: killer.tier,        inline: true },
        { name: '💨 Speed',     value: killer.speed,       inline: true },
        { name: '👂 Terror',    value: killer.terror,      inline: true },
        { name: '📋 Overview',  value: killer.description, inline: false },
        { name: '💡 Tip',       value: killer.tip,         inline: false },
        ...(killer.controversy ? [{ name: '⚠️ Note', value: killer.controversy, inline: false }] : [])
      ],
      footer: { text: 'Dead by Daylight · 2026 Meta' }
    })] });
  }

  // ── DBD RANDOM KILLER ────────────────────────────────────────
  else if (cmd === 'randomkiller') {
    const killers = Object.values(DBD_KILLERS);
    const k = killers[Math.floor(Math.random() * killers.length)];
    await i.reply({ embeds: [embed({ color: C.blood, title: `🎲 Tonight you play... ${k.name}!`, fields: [{ name: '⚡ Power', value: k.power, inline: true }, { name: '🏆 Tier', value: k.tier, inline: true }, { name: '💡 Tip', value: k.tip, inline: false }], footer: { text: 'No excuses. Get in there.' } })] });
  }

  // ── DBD TRACKER ──────────────────────────────────────────────
  else if (cmd === 'tracker') {
    const username = i.options.getString('username');
    const url = `https://nightlight.gg/players/${encodeURIComponent(username)}`;
    await i.reply({ embeds: [embed({ color: C.orange, title: `📊 DBD Tracker — ${username}`, description: `View **${username}**'s Dead by Daylight stats on Nightlight.gg\n\n🔗 [Click here to view stats](${url})`, fields: [{ name: '📈 What you can see', value: 'Kill rate, escape rate, most played killers/survivors, perk usage, match history and more.', inline: false }], footer: { text: 'Powered by nightlight.gg' } })] });
  }

  // ── DBD SHRINE ───────────────────────────────────────────────
  else if (cmd === 'shrine') {
    await i.reply({ embeds: [embed({ color: C.purple, title: '⛩️ Shrine of Secrets', description: 'The Shrine of Secrets rotates weekly on **Wednesdays**.\n\n🔗 [Check current shrine on the DBD Wiki](https://deadbydaylight.wiki.gg/wiki/Shrine_of_Secrets)\n🔗 [Or on nightlight.gg](https://nightlight.gg/shrine)', fields: [{ name: '💡 Tip', value: 'The Shrine lets you unlock character perks with Iridescent Shards without buying the character. Always check it weekly!', inline: false }], footer: { text: 'Shrine rotates every Wednesday at 12:00 UTC' } })] });
  }

  // ── DBD BUILD ────────────────────────────────────────────────
  else if (cmd === 'build') {
    const side = i.options.getString('side');
    if (side === 'survivor') {
      await i.reply({ embeds: [embed({ color: C.orange, title: '🏃 Recommended Survivor Build (2026)', fields: [
        { name: '🏆 Meta Build', value: '**Off the Record** + **Decisive Strike** + **Borrowed Time** + **Windows of Opportunity**\nBest anti-tunnel + team support + information build.', inline: false },
        { name: '🥈 Chase Build', value: '**Dead Hard** + **Sprint Burst** + **Lithe** + **Adrenaline**\nMaximum chase potential with multiple exhaustion perks.', inline: false },
        { name: '🥉 Solo Queue Carry', value: '**Kindred** + **Borrowed Time** + **Adrenaline** + **Off the Record**\nBest for carrying solo queue with information and anti-tunnel.', inline: false }
      ], footer: { text: 'DBD 2026 Meta Builds' } })] });
    } else {
      await i.reply({ embeds: [embed({ color: C.blood, title: '🔪 Recommended Killer Build (2026)', fields: [
        { name: '🏆 Meta Build', value: '**Corrupt Intervention** + **Pop Goes the Weasel** + **Pain Resonance** + **BBQ & Chili**\nBest gen regression build with free pressure and info.', inline: false },
        { name: '🥈 Info Build', value: '**Lethal Pursuer** + **Nowhere to Hide** + **BBQ & Chili** + **Tinkerer**\nAlways know where survivors are at all times.', inline: false },
        { name: '🥉 Hook Pressure', value: '**Corrupt Intervention** + **Scourge Hook: Pain Resonance** + **Scourge Hook: Gift of Pain** + **Pop Goes the Weasel**\nEvery hook punishes survivors with gen regression.', inline: false }
      ], footer: { text: 'DBD 2026 Meta Builds' } })] });
    }
  }

  // ── DBD RULES ────────────────────────────────────────────────
  else if (cmd === 'dbd-rules') {
    if (!member.permissions.has(PermissionFlagsBits.ManageMessages)) return i.reply({ content: '❌ No permission.', ephemeral: true });
    await i.channel.send({ embeds: [embed({
      color: C.blood,
      title: '📜 Server Rules',
      description: [
        '**No Tunnelling** 🪝',
        'Going straight back to the recently unhooked survivor is not cool. Give them a chance.',
        '',
        '**No Camping** ⛺',
        'Standing at the hook and refusing to patrol is boring for everyone. Play the game.',
        '',
        '**No Skull Merchant BS** 💀',
        "We don't want to see the drone camping Skull Merchant builds. Play something fun.",
        '',
        '**No Harassment** 🚫',
        'GG only in end game chat. No abuse, trash talk, or targeting specific players.',
        '',
        '**No NSFW** 🔞',
        'Keep content appropriate. No explicit images, videos or links.',
        '',
        '**No Spam** 📵',
        'No spam messages, soundboard abuse, or excessive pings.',
        '',
        '**No Advertising** 📢',
        'Do not advertise other servers or social media without staff permission.',
        '',
        '**Staff Have Final Say** ⚖️',
        'If a mod asks you to stop — stop. No arguing.',
        '',
        '⚠️ *Breaking rules will result in warns, timeouts or bans. All I ask is be cool.* 🩸'
      ].join('\n'),
      footer: { text: `${guild.name} · Rules` }
    })] });
    await i.reply({ content: '✅ Rules posted!', ephemeral: true });
  }

  // ── MODERATION ───────────────────────────────────────────────

  else if (cmd === 'ban') {
    const t = i.options.getMember('user'), reason = i.options.getString('reason') || 'No reason';
    if (!t?.bannable) return i.reply({ content: '❌ Cannot ban that user.', ephemeral: true });
    await t.ban({ reason, deleteMessageSeconds: (i.options.getInteger('delete_days')||0)*86400 });
    const e = embed({ color: C.blood, title: '🔨 Banned', fields: [{ name: 'User', value: t.user.tag, inline: true }, { name: 'Mod', value: user.tag, inline: true }, { name: 'Reason', value: reason }] });
    await i.reply({ embeds: [e] }); logMod(guild, e);
  }
  else if (cmd === 'kick') {
    const t = i.options.getMember('user'), reason = i.options.getString('reason') || 'No reason';
    if (!t?.kickable) return i.reply({ content: '❌ Cannot kick that user.', ephemeral: true });
    await t.kick(reason);
    const e = embed({ color: C.red, title: '👢 Kicked', fields: [{ name: 'User', value: t.user.tag, inline: true }, { name: 'Mod', value: user.tag, inline: true }, { name: 'Reason', value: reason }] });
    await i.reply({ embeds: [e] }); logMod(guild, e);
  }
  else if (cmd === 'timeout') {
    const t = i.options.getMember('user'), dur = parseTime(i.options.getString('duration')), reason = i.options.getString('reason') || 'No reason';
    if (!t) return i.reply({ content: '❌ User not found.', ephemeral: true });
    if (!dur) return i.reply({ content: '❌ Invalid duration. Use: 10m 1h 1d', ephemeral: true });
    await t.timeout(dur, reason);
    const e = embed({ color: C.yellow, title: '⏱️ Timed Out', fields: [{ name: 'User', value: t.user.tag, inline: true }, { name: 'Duration', value: i.options.getString('duration'), inline: true }, { name: 'Reason', value: reason }] });
    await i.reply({ embeds: [e] }); logMod(guild, e);
  }
  else if (cmd === 'untimeout') {
    const t = i.options.getMember('user'); if (!t) return i.reply({ content: '❌ User not found.', ephemeral: true });
    await t.timeout(null);
    await i.reply({ embeds: [embed({ color: C.green, description: `✅ Removed timeout from ${t}` })] });
  }
  else if (cmd === 'warn') {
    const t = i.options.getUser('user'), reason = i.options.getString('reason');
    if (!warnings[t.id]) warnings[t.id] = [];
    warnings[t.id].push({ reason, mod: user.tag, date: new Date().toISOString(), guild: guild.id });
    save('warnings.json', warnings);
    const cnt = warnings[t.id].filter(w => w.guild === guild.id).length;
    const e = embed({ color: C.yellow, title: '⚠️ Warning', fields: [{ name: 'User', value: t.tag, inline: true }, { name: 'Mod', value: user.tag, inline: true }, { name: 'Reason', value: reason }, { name: 'Total', value: cnt.toString(), inline: true }] });
    await i.reply({ embeds: [e] }); logMod(guild, e);
    t.send({ embeds: [embed({ color: C.yellow, title: `⚠️ Warning in ${guild.name}`, fields: [{ name: 'Reason', value: reason }] })] }).catch(()=>{});
    const gm = guild.members.cache.get(t.id);
    if (gm && cnt === 3) { await gm.timeout(3_600_000, 'Auto: 3 warnings').catch(()=>{}); i.followUp({ content: `⚠️ Auto-timeout: 3 warnings.` }); }
    if (gm && cnt >= 5)  { await gm.ban({ reason: 'Auto: 5+ warnings' }).catch(()=>{}); i.followUp({ content: `🔨 Auto-ban: 5 warnings.` }); }
  }
  else if (cmd === 'warnings') {
    const t = i.options.getUser('user');
    const list = (warnings[t.id]||[]).filter(w=>w.guild===guild.id);
    if (!list.length) return i.reply({ embeds: [embed({ color: C.green, description: `${t.tag} has no warnings.` })] });
    await i.reply({ embeds: [embed({ color: C.yellow, title: `⚠️ Warnings — ${t.tag}`, description: `**${list.length}** total`, fields: list.slice(-10).map((w,idx) => ({ name: `#${idx+1}`, value: `**Reason:** ${w.reason}\n**By:** ${w.mod}\n**Date:** <t:${Math.floor(new Date(w.date).getTime()/1000)}:R>`, inline: true })) })] });
  }
  else if (cmd === 'clearwarnings') {
    const t = i.options.getUser('user');
    warnings[t.id] = (warnings[t.id]||[]).filter(w=>w.guild!==guild.id);
    save('warnings.json', warnings); await i.reply({ embeds: [embed({ color: C.green, description: `✅ Cleared warnings for ${t.tag}` })] });
  }
  else if (cmd === 'purge') {
    const amount = i.options.getInteger('amount'), targetUser = i.options.getUser('user');
    await i.deferReply({ ephemeral: true });
    const cutoff = Date.now() - 14*24*60*60*1000;
    const fetched = await i.channel.messages.fetch({ limit: Math.min(amount+5, 100) });
    let fresh = [...fetched.values()].filter(m => m.createdTimestamp > cutoff);
    if (targetUser) fresh = fresh.filter(m => m.author.id === targetUser.id);
    fresh = fresh.slice(0, amount);
    if (!fresh.length) return i.editReply({ content: '❌ No deletable messages found.' });
    const del = await i.channel.bulkDelete(fresh, true);
    const n = await i.editReply({ content: `✅ Deleted **${del.size}** messages.` });
  }
  else if (cmd === 'unban') {
    try { await guild.members.unban(i.options.getString('userid')); await i.reply({ embeds: [embed({ color: C.green, description: `✅ Unbanned \`${i.options.getString('userid')}\`` })] }); }
    catch { await i.reply({ content: '❌ Could not unban. Check the ID.', ephemeral: true }); }
  }
  else if (cmd === 'lock') {
    const channel = i.options.getChannel('channel') || i.channel, reason = i.options.getString('reason') || 'No reason';
    await channel.permissionOverwrites.edit(guild.id, { SendMessages: false });
    channel.send({ embeds: [embed({ color: C.blood, title: '🔒 Channel Locked', description: `Locked by ${user}. **Reason:** ${reason}` })] });
    await i.reply({ content: `✅ Locked ${channel}`, ephemeral: true });
  }
  else if (cmd === 'unlock') {
    const channel = i.options.getChannel('channel') || i.channel;
    await channel.permissionOverwrites.edit(guild.id, { SendMessages: null });
    channel.send({ embeds: [embed({ color: C.green, title: '🔓 Channel Unlocked', description: `Unlocked by ${user}.` })] });
    await i.reply({ content: `✅ Unlocked ${channel}`, ephemeral: true });
  }
  else if (cmd === 'slowmode') {
    const secs = i.options.getInteger('seconds'), channel = i.options.getChannel('channel') || i.channel;
    await channel.setRateLimitPerUser(secs);
    await i.reply({ embeds: [embed({ color: C.yellow, description: secs === 0 ? `✅ Slowmode disabled in ${channel}` : `✅ Slowmode set to **${secs}s** in ${channel}` })] });
  }
  else if (cmd === 'giverole') {
    const t = i.options.getMember('user'), role = i.options.getRole('role');
    if (!t || role.managed || t.roles.cache.has(role.id)) return i.reply({ content: '❌ Cannot assign this role.', ephemeral: true });
    await t.roles.add(role);
    await i.reply({ embeds: [embed({ color: C.green, description: `✅ Gave **${role.name}** to ${t}` })] });
  }
  else if (cmd === 'removerole') {
    const t = i.options.getMember('user'), role = i.options.getRole('role');
    if (!t || !t.roles.cache.has(role.id)) return i.reply({ content: '❌ Cannot remove this role.', ephemeral: true });
    await t.roles.remove(role);
    await i.reply({ embeds: [embed({ color: C.green, description: `✅ Removed **${role.name}** from ${t}` })] });
  }
  else if (cmd === 'nick') {
    const t = i.options.getMember('user'), nick = i.options.getString('nickname');
    if (!t) return i.reply({ content: '❌ User not found.', ephemeral: true });
    await t.setNickname(nick || null);
    await i.reply({ embeds: [embed({ color: C.green, description: nick ? `✅ Nickname set to **${nick}**` : `✅ Reset nickname` })] });
  }

  // ── UTILITY ──────────────────────────────────────────────────

  else if (cmd === 'userinfo') {
    const t = i.options.getMember('user') || member;
    const roles = t.roles.cache.filter(r=>r.id!==guild.id).sort((a,b)=>b.position-a.position).map(r=>r.toString()).slice(0,10).join(' ')||'None';
    await i.reply({ embeds: [embed({ color: C.orange, title: t.user.tag, thumbnail: t.user.displayAvatarURL({ dynamic: true, size: 256 }), fields: [{ name: '🆔 ID', value: t.user.id, inline: true }, { name: '📅 Account', value: `<t:${Math.floor(t.user.createdTimestamp/1000)}:R>`, inline: true }, { name: '📥 Joined', value: `<t:${Math.floor(t.joinedTimestamp/1000)}:R>`, inline: true }, { name: '🎭 Top Role', value: t.roles.highest.toString(), inline: true }, { name: `🎭 Roles`, value: roles }] })] });
  }
  else if (cmd === 'serverinfo') {
    const owner = await guild.fetchOwner(), chans = guild.channels.cache;
    await i.reply({ embeds: [embed({ color: C.orange, title: guild.name, thumbnail: guild.iconURL({ dynamic: true }), fields: [{ name: '🆔 ID', value: guild.id, inline: true }, { name: '👑 Owner', value: owner.user.tag, inline: true }, { name: '📅 Created', value: `<t:${Math.floor(guild.createdTimestamp/1000)}:R>`, inline: true }, { name: '👥 Members', value: guild.memberCount.toString(), inline: true }, { name: '💬 Text', value: chans.filter(c=>c.type===ChannelType.GuildText).size.toString(), inline: true }, { name: '🔊 Voice', value: chans.filter(c=>c.type===ChannelType.GuildVoice).size.toString(), inline: true }] })] });
  }
  else if (cmd === 'avatar') {
    const t = i.options.getUser('user') || user;
    await i.reply({ embeds: [embed({ color: C.orange, title: `${t.tag}'s Avatar`, image: t.displayAvatarURL({ dynamic: true, size: 4096 }) })] });
  }
  else if (cmd === 'rank') {
    const t = i.options.getUser('user') || user;
    const key = `${guild.id}-${t.id}`, d = levels[key] || { xp: 0, level: 0 };
    const allG = Object.entries(levels).filter(([k])=>k.startsWith(guild.id)).sort(([,a],[,b])=>b.xp-a.xp);
    const pos = allG.findIndex(([k])=>k===key)+1;
    await i.reply({ embeds: [embed({ color: C.orange, title: `📊 ${t.username}'s Rank`, thumbnail: t.displayAvatarURL({ dynamic: true }), fields: [{ name: '🏆 Rank', value: `#${pos||'?'}`, inline: true }, { name: '⭐ Level', value: d.level.toString(), inline: true }, { name: '✨ XP', value: d.xp.toString(), inline: true }] })] });
  }
  else if (cmd === 'leaderboard') {
    const top = Object.entries(levels).filter(([k])=>k.startsWith(guild.id)).sort(([,a],[,b])=>b.xp-a.xp).slice(0,10);
    const medal = ['🥇','🥈','🥉'];
    const fields = top.map(([key,d],idx) => { const uid = d.userId||key.split('-')[1]; const m = guild.members.cache.get(uid); return { name: `${medal[idx]||`#${idx+1}`} ${m?.user.tag||'Unknown'}`, value: `Level **${d.level}** · **${d.xp}** XP`, inline: false }; });
    await i.reply({ embeds: [embed({ color: C.orange, title: `🏆 ${guild.name} Leaderboard`, fields: fields.length ? fields : [{ name: 'Empty', value: 'No data yet.' }] })] });
  }
  else if (cmd === 'poll') {
    const question = i.options.getString('question');
    const opts = [i.options.getString('option1'), i.options.getString('option2'), i.options.getString('option3'), i.options.getString('option4')].filter(Boolean);
    const emojis = ['1️⃣','2️⃣','3️⃣','4️⃣'];
    const desc = opts.length ? opts.map((o,idx)=>`${emojis[idx]} ${o}`).join('\n\n') : '👍 Yes\n\n👎 No';
    const msg = await i.channel.send({ embeds: [embed({ color: C.purple, title: `📊 ${question}`, description: desc, footer: { text: `Poll by ${user.tag}` } })] });
    if (opts.length) { for (const e of emojis.slice(0,opts.length)) await msg.react(e); }
    else { await msg.react('👍'); await msg.react('👎'); }
    await i.reply({ content: '✅ Poll created!', ephemeral: true });
  }
  else if (cmd === 'announce') {
    const title = i.options.getString('title'), message = i.options.getString('message');
    const channel = i.options.getChannel('channel') || i.channel;
    const ping = i.options.getString('ping') || 'none';
    const pingStr = ping === 'everyone' ? '@everyone' : ping === 'here' ? '@here' : '';
    await channel.send({ content: pingStr || undefined, embeds: [embed({ color: C.orange, title: `📢 ${title}`, description: message, footer: { text: `Announced by ${user.tag}`, iconURL: user.displayAvatarURL() } })] });
    await i.reply({ content: `✅ Sent in ${channel}`, ephemeral: true });
  }
  else if (cmd === 'say') {
    const message = i.options.getString('message'), channel = i.options.getChannel('channel') || i.channel;
    await channel.send(message); await i.reply({ content: '✅ Sent!', ephemeral: true });
  }
  else if (cmd === 'remind') {
    const ms = parseTime(i.options.getString('time')), message = i.options.getString('message');
    if (!ms) return i.reply({ content: '❌ Invalid time. Use: 10m 1h 2d', ephemeral: true });
    await i.reply({ embeds: [embed({ color: C.green, description: `⏰ Got it! Reminding you <t:${Math.floor((Date.now()+ms)/1000)}:R>` })] });
    setTimeout(() => { i.channel.send({ content: `⏰ ${user} **Reminder:** ${message}` }).catch(()=>{}); }, ms);
  }
  else if (cmd === '8ball') {
    const answers = ['✅ It is certain.','✅ Without a doubt.','✅ Yes.','✅ Most likely.','🤔 Ask again later.','🤔 Cannot predict now.','❌ Doubtful.','❌ Very doubtful.','❌ My sources say no.'];
    await i.reply({ embeds: [embed({ color: C.purple, title: '🎱 Magic 8-Ball', fields: [{ name: '❓ Question', value: i.options.getString('question') }, { name: '🎱 Answer', value: answers[Math.floor(Math.random()*answers.length)] }] })] });
  }
  else if (cmd === 'coinflip') {
    await i.reply({ embeds: [embed({ color: C.orange, title: '🪙 Coin Flip', description: `**${Math.random()<0.5?'Heads':'Tails'}**!` })] });
  }
  else if (cmd === 'afk') {
    const reason = i.options.getString('reason') || '';
    afkUsers[user.id] = { reason, time: Date.now(), tag: user.tag }; save('afk.json', afkUsers);
    await i.reply({ embeds: [embed({ color: C.yellow, description: `💤 You are now AFK${reason ? ` — *${reason}*` : ''}.` })] });
  }
  else if (cmd === 'birthday') {
    const sub = i.options.getSubcommand();
    if (sub === 'set') {
      const day = i.options.getInteger('day'), month = i.options.getInteger('month');
      if (day<1||day>31||month<1||month>12) return i.reply({ content: '❌ Invalid date.', ephemeral: true });
      birthdays[user.id] = { date: `${month}-${day}`, tag: user.tag }; save('birthdays.json', birthdays);
      await i.reply({ embeds: [embed({ color: C.orange, description: `🎂 Birthday set to **${day}/${month}**!` })], ephemeral: true });
    } else if (sub === 'remove') {
      delete birthdays[user.id]; save('birthdays.json', birthdays);
      await i.reply({ content: '✅ Birthday removed.', ephemeral: true });
    } else if (sub === 'check') {
      const t = i.options.getUser('user') || user, d = birthdays[t.id];
      if (!d) return i.reply({ content: `❌ ${t.username} has no birthday set.`, ephemeral: true });
      const [month, day] = d.date.split('-');
      await i.reply({ embeds: [embed({ color: C.orange, description: `🎂 **${t.username}**'s birthday is **${day}/${month}**` })] });
    } else if (sub === 'list') {
      const list = Object.entries(birthdays).slice(0,20).map(([id,d]) => { const [month,day]=d.date.split('-'); return `<@${id}> — **${day}/${month}**`; }).join('\n');
      await i.reply({ embeds: [embed({ color: C.orange, title: '🎂 Server Birthdays', description: list || 'No birthdays set yet.' })] });
    }
  }

  // ── MUSIC ────────────────────────────────────────────────────

  else if (cmd === 'play') {
    const vc = member.voice.channel;
    if (!vc) return i.reply({ content: '❌ Join a voice channel first!', ephemeral: true });
    await i.deferReply();
    try {
      const result = await player.search(i.options.getString('query'), { requestedBy: user });
      if (!result.tracks.length) return i.editReply('❌ No results found.');
      const track = result.tracks[0];
      let queue = player.nodes.get(guild.id);
      if (!queue) queue = player.nodes.create(guild, { metadata: i.channel, selfDeaf: false, volume: 80, leaveOnEmpty: true, leaveOnEmptyCooldown: 180000, leaveOnEnd: false });
      if (!queue.connection) await queue.connect(vc);
      const wasPlaying = queue.isPlaying();
      queue.addTrack(track);
      if (!wasPlaying) await queue.node.play();
      await i.editReply({ embeds: [embed({ color: !wasPlaying ? C.green : C.purple, title: !wasPlaying ? '🎵 Now Playing' : '➕ Added to Queue', description: `**[${track.title}](${track.url})**`, thumbnail: track.thumbnail, fields: [{ name: '⏱️ Duration', value: track.duration, inline: true }, { name: '👤 Requested by', value: user.tag, inline: true }] })] });
    } catch (err) { console.error('[PLAY ERROR]', err.message); await i.editReply(`❌ Failed: ${err.message}`); }
  }
  else if (cmd === 'skip') {
    const queue = player.nodes.get(guild.id);
    if (!queue?.isPlaying()) return i.reply({ content: '❌ Nothing playing!', ephemeral: true });
    queue.node.skip(); await i.reply({ embeds: [embed({ color: C.green, description: '⏭️ Skipped!' })] });
  }
  else if (cmd === 'stop') {
    const queue = player.nodes.get(guild.id);
    if (queue) queue.delete(); await i.reply({ embeds: [embed({ color: C.green, description: '⏹️ Stopped.' })] });
  }
  else if (cmd === 'queue') {
    const queue = player.nodes.get(guild.id);
    if (!queue?.tracks.size && !queue?.currentTrack) return i.reply({ embeds: [embed({ color: C.purple, description: '📋 Queue is empty.' })] });
    const current = queue.currentTrack, tracks = queue.tracks.toArray().slice(0,9);
    const lines = (current ? [`▶️ **${current.title}** · ${current.duration}`] : []).concat(tracks.map((t,n)=>`${n+1}. **${t.title}** · ${t.duration}`));
    await i.reply({ embeds: [embed({ color: C.purple, title: '📋 Queue', description: lines.join('\n') })] });
  }
  else if (cmd === 'pause') {
    const queue = player.nodes.get(guild.id);
    if (!queue?.isPlaying()) return i.reply({ content: '❌ Nothing playing!', ephemeral: true });
    queue.node.pause(); await i.reply({ embeds: [embed({ color: C.yellow, description: '⏸️ Paused.' })] });
  }
  else if (cmd === 'resume') {
    const queue = player.nodes.get(guild.id);
    if (!queue?.node.isPaused()) return i.reply({ content: '❌ Not paused!', ephemeral: true });
    queue.node.resume(); await i.reply({ embeds: [embed({ color: C.green, description: '▶️ Resumed.' })] });
  }
  else if (cmd === 'nowplaying') {
    const queue = player.nodes.get(guild.id), track = queue?.currentTrack;
    if (!track) return i.reply({ content: '❌ Nothing playing!', ephemeral: true });
    await i.reply({ embeds: [embed({ color: C.purple, title: '🎵 Now Playing', description: `**[${track.title}](${track.url})**`, thumbnail: track.thumbnail, fields: [{ name: '⏱️', value: track.duration, inline: true }, { name: '👤', value: track.requestedBy?.tag||'Unknown', inline: true }] })] });
  }
  else if (cmd === 'volume') {
    const queue = player.nodes.get(guild.id), lvl = i.options.getInteger('level');
    if (!queue) return i.reply({ content: '❌ Nothing playing!', ephemeral: true });
    queue.node.setVolume(lvl); await i.reply({ embeds: [embed({ color: C.green, description: `🔊 Volume set to **${lvl}%**` })] });
  }
  else if (cmd === 'shuffle') {
    const queue = player.nodes.get(guild.id);
    if (!queue?.tracks.size) return i.reply({ content: '❌ Not enough songs.', ephemeral: true });
    queue.tracks.shuffle(); await i.reply({ embeds: [embed({ color: C.green, description: '🔀 Queue shuffled!' })] });
  }

  // ── SETUP ────────────────────────────────────────────────────

  else if (cmd === 'setup-verify') {
    const target = ch(guild,'verify','verify') || i.channel;
    await target.send({ embeds: [embed({ color: C.orange, title: '🩸 Verification', description: `Welcome to **${guild.name}**!\n\nClick the button below to enter the fog and gain access to the server.`, thumbnail: guild.iconURL({ dynamic: true }), footer: { text: `${guild.name} · Verification` } })], components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('verify').setLabel('🩸 Enter the Fog').setStyle(ButtonStyle.Danger))] });
    await i.reply({ content: `✅ Verification panel posted in ${target}`, ephemeral: true });
  }
  else if (cmd === 'setup-ticket') {
    await i.channel.send({ embeds: [embed({ color: C.orange, title: '🎫 Support Tickets', description: `Need help from staff? Click below to open a private ticket.`, footer: { text: `${guild.name} · Support` } })], components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('create-ticket').setLabel('🎫 Open Ticket').setStyle(ButtonStyle.Primary))] });
    await i.reply({ content: '✅ Ticket panel posted!', ephemeral: true });
  }
  else if (cmd === 'setup-roles') {
    const list = roleMenus[guild.id];
    if (!list?.length) return i.reply({ content: '❌ No roles added. Use /add-role-option first.', ephemeral: true });
    const target = ch(guild,'roles','roles') || i.channel;
    const menu = new StringSelectMenuBuilder().setCustomId('role-select').setPlaceholder('Pick your roles...').setMinValues(0).setMaxValues(list.length).addOptions(list.map(r => { const role = guild.roles.cache.get(r.id); const opt = { label: role?.name||'Unknown', value: r.id }; if(r.desc) opt.description = r.desc; if(r.emoji) opt.emoji = r.emoji; return opt; }));
    await target.send({ embeds: [embed({ color: C.orange, title: '🎭 Role Selection', description: list.map(r=>`${r.emoji||'•'} <@&${r.id}>${r.desc?` — ${r.desc}`:''}`).join('\n'), footer: { text: `${guild.name} · Roles` } })], components: [new ActionRowBuilder().addComponents(menu)] });
    await i.reply({ content: `✅ Role panel posted in ${target}`, ephemeral: true });
  }
  else if (cmd === 'add-role-option') {
    const role = i.options.getRole('role'), emoji = i.options.getString('emoji'), desc = i.options.getString('description');
    if (!roleMenus[guild.id]) roleMenus[guild.id] = [];
    const idx = roleMenus[guild.id].findIndex(r=>r.id===role.id);
    const obj = { id: role.id, emoji, desc };
    idx !== -1 ? roleMenus[guild.id][idx] = obj : roleMenus[guild.id].push(obj);
    save('role-menus.json', roleMenus);
    await i.reply({ content: `✅ Added **${role.name}** to role menu!`, ephemeral: true });
  }
  else if (cmd === 'setup-perms') {
    await i.deferReply({ ephemeral: true });
    const rId = config.roles?.verified;
    const verifiedRole = (rId && guild.roles.cache.get(rId)) || guild.roles.cache.find(r => ['verified','member','members'].includes(r.name.toLowerCase())) || guild.roles.cache.find(r => r.name.toLowerCase().includes('verif') || r.name.toLowerCase().includes('member'));
    if (!verifiedRole) return i.editReply('❌ No verified role found. Create a role called "Member" or "Verified" first.');
    const everyoneRole = guild.id;
    const privateNames = ['general','clips','memes','music','socials','pictures','roles','help','announcements','stream-alerts','gaming','dbd','killer','survivor'];
    const publicNames  = ['verify','welcome','rules'];
    const hiddenNames  = ['private','mod-logs','admins','mods','moderator-only','audit-logs'];
    const modRole = config.roles?.mod ? guild.roles.cache.get(config.roles.mod) : guild.roles.cache.find(r => r.name.toLowerCase().includes('mod'));
    let done = 0, results = [];
    for (const [, channel] of guild.channels.cache) {
      const name = channel.name.toLowerCase();
      try {
        if (hiddenNames.some(n=>name.includes(n))) {
          await channel.permissionOverwrites.set([{ id: everyoneRole, deny: [PermissionFlagsBits.ViewChannel] }, { id: guild.members.me.id, allow: [PermissionFlagsBits.ViewChannel] }, ...(modRole?[{ id: modRole.id, allow: [PermissionFlagsBits.ViewChannel] }]:[]) ]);
          results.push(`🔒 Hidden: #${channel.name}`); done++;
        } else if (publicNames.some(n=>name.includes(n))) {
          await channel.permissionOverwrites.set([{ id: everyoneRole, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory], deny: [PermissionFlagsBits.SendMessages] }, { id: verifiedRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }, { id: guild.members.me.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }]);
          results.push(`🌐 Public: #${channel.name}`); done++;
        } else if (privateNames.some(n=>name.includes(n))) {
          await channel.permissionOverwrites.set([{ id: everyoneRole, deny: [PermissionFlagsBits.ViewChannel] }, { id: verifiedRole.id, allow: [PermissionFlagsBits.ViewChannel] }, { id: guild.members.me.id, allow: [PermissionFlagsBits.ViewChannel] }]);
          results.push(`✅ Members-only: #${channel.name}`); done++;
        }
      } catch (err) { results.push(`❌ Failed: #${channel.name}`); }
    }
    const summary = results.slice(0,25).join('\n') + (results.length > 25 ? `\n...and ${results.length-25} more` : '');
    await i.editReply({ embeds: [embed({ color: C.green, title: `✅ Permissions Set (${done} channels)`, description: summary || 'No channels matched.' })] });
  }
  else if (cmd === 'add-streamer') {
    const name = i.options.getString('username').toLowerCase();
    if (!config.twitch.streamers) config.twitch.streamers = [];
    if (config.twitch.streamers.includes(name)) return i.reply({ content: `❌ Already tracking **${name}**.`, ephemeral: true });
    config.twitch.streamers.push(name); fs.writeFileSync('./config.json', JSON.stringify(config, null, 2));
    await i.reply({ content: `✅ Now tracking **${name}** on Twitch!`, ephemeral: true });
  }
  else if (cmd === 'remove-streamer') {
    const name = i.options.getString('username').toLowerCase();
    config.twitch.streamers = (config.twitch.streamers||[]).filter(s=>s!==name); fs.writeFileSync('./config.json', JSON.stringify(config, null, 2));
    await i.reply({ content: `✅ Stopped tracking **${name}**.`, ephemeral: true });
  }
  else if (cmd === 'help') {
    await i.reply({ ephemeral: true, embeds: [embed({ color: C.orange, title: '📚 Seine Bot — Commands',
      fields: [
        { name: '🩸 DBD', value: '`/perk` `/killer` `/randomkiller` `/tracker` `/shrine` `/build` `/dbd-rules`', inline: false },
        { name: '🛡️ Moderation', value: '`/ban` `/kick` `/timeout` `/warn` `/purge` `/lock` `/unlock` `/giverole`', inline: false },
        { name: '⭐ Leveling', value: '`/rank` `/leaderboard`', inline: false },
        { name: '🎵 Music', value: '`/play` `/skip` `/stop` `/queue` `/pause` `/resume` `/volume`', inline: false },
        { name: '📢 Utility', value: '`/poll` `/announce` `/say` `/remind` `/8ball` `/coinflip` `/afk` `/birthday`', inline: false },
        { name: '⚙️ Setup', value: '`/setup-verify` `/setup-roles` `/setup-ticket` `/setup-perms` `/add-role-option`', inline: false },
        { name: '🎮 Prefix (,)', value: '`,ban` `,kick` `,warn` `,purge` `,lock` `,unlock` `,say` `,rank` `,afk`', inline: false }
      ],
      footer: { text: 'Seine Bot · Dead by Daylight' }
    })] });
  }
}

// =============================================================
//  BUTTON HANDLER
// =============================================================

async function handleButton(i) {
  const { customId, guild, member, user } = i;

  if (customId === 'verify') {
    try {
      const rId = config.roles?.verified;
      const role = (rId && guild.roles.cache.get(rId)) || guild.roles.cache.find(r => ['verified','member','members'].includes(r.name.toLowerCase())) || guild.roles.cache.find(r => r.name.toLowerCase().includes('verif') || r.name.toLowerCase().includes('member'));
      if (!role) return i.reply({ content: '❌ No verified role found. Ask an admin!', ephemeral: true });
      const botMember = guild.members.me;
      if (role.position >= botMember.roles.highest.position) return i.reply({ content: '❌ My role needs to be above the verified role. Ask an admin!', ephemeral: true });
      if (member.roles.cache.has(role.id)) return i.reply({ content: '✅ You are already verified!', ephemeral: true });
      await member.roles.add(role, 'Verified via button');
      await i.reply({ embeds: [embed({ color: C.orange, title: '🩸 Verified!', description: `Welcome to **${guild.name}**! You have entered the fog. 🪝` })], ephemeral: true });
      logAudit(guild, embed({ color: C.green, title: '✅ Member Verified', fields: [{ name: 'User', value: `${user.tag} (${user.id})` }] }));
    } catch (err) { i.reply({ content: `❌ Verification failed: ${err.message}`, ephemeral: true }); }
    return;
  }

  if (customId === 'music-pause') {
    const queue = player.nodes.get(guild.id);
    if (!queue?.isPlaying()) return i.reply({ content: '❌ Nothing playing!', ephemeral: true });
    queue.node.isPaused() ? queue.node.resume() : queue.node.pause();
    await i.reply({ embeds: [embed({ color: C.yellow, description: queue.node.isPaused() ? '▶️ Resumed.' : '⏸️ Paused.' })], ephemeral: true }); return;
  }
  if (customId === 'music-skip') {
    const queue = player.nodes.get(guild.id);
    if (!queue?.isPlaying()) return i.reply({ content: '❌ Nothing playing!', ephemeral: true });
    queue.node.skip(); await i.reply({ embeds: [embed({ color: C.green, description: '⏭️ Skipped!' })], ephemeral: true }); return;
  }
  if (customId === 'music-stop') {
    const queue = player.nodes.get(guild.id);
    if (queue) queue.delete(); await i.reply({ embeds: [embed({ color: C.blood, description: '⏹️ Stopped.' })], ephemeral: true }); return;
  }
  if (customId === 'music-queue') {
    const queue = player.nodes.get(guild.id);
    if (!queue?.tracks.size && !queue?.currentTrack) return i.reply({ embeds: [embed({ description: '📋 Queue is empty.' })], ephemeral: true });
    const current = queue.currentTrack, tracks = queue.tracks.toArray().slice(0,9);
    const lines = (current?[`▶️ **${current.title}** · ${current.duration}`]:[]).concat(tracks.map((t,n)=>`${n+1}. **${t.title}** · ${t.duration}`));
    await i.reply({ embeds: [embed({ color: C.purple, title: '📋 Queue', description: lines.join('\n') })], ephemeral: true }); return;
  }

  if (customId === 'create-ticket') {
    if (!ticketData[guild.id]) ticketData[guild.id] = {};
    const existing = Object.values(ticketData[guild.id]).find(t=>t.userId===user.id&&t.status==='open');
    if (existing) { const ec = guild.channels.cache.get(existing.channelId); if(ec) return i.reply({ content: `❌ You already have a ticket: ${ec}`, ephemeral: true }); }
    await i.deferReply({ ephemeral: true });
    const n = Object.keys(ticketData[guild.id]).length + 1;
    const cat = guild.channels.cache.find(c=>c.type===ChannelType.GuildCategory&&c.name.toLowerCase().includes('ticket'));
    const modR = config.roles?.mod ? guild.roles.cache.get(config.roles.mod) : guild.roles.cache.find(r=>r.name.toLowerCase().includes('mod'));
    const tc = await guild.channels.create({ name: `ticket-${String(n).padStart(4,'0')}-${user.username}`, type: ChannelType.GuildText, parent: cat?.id, permissionOverwrites: [{ id: guild.id, deny: [PermissionFlagsBits.ViewChannel] }, { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }, { id: guild.members.me.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ReadMessageHistory] }] });
    if (modR) await tc.permissionOverwrites.create(modR, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true }).catch(()=>{});
    ticketData[guild.id][tc.id] = { channelId: tc.id, userId: user.id, userTag: user.tag, status: 'open', opened: new Date().toISOString(), claimedBy: null };
    save('tickets.json', ticketData);
    await tc.send({ content: `${user} ${modR??''}`, embeds: [embed({ color: C.orange, title: `🎫 Ticket #${String(n).padStart(4,'0')}`, description: `Hi ${user}, describe your issue and staff will assist you shortly.`, fields: [{ name: '👤 Opened by', value: user.tag, inline: true }], footer: { text: `${guild.name} · Tickets` } })], components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('claim-ticket').setLabel('🙋 Claim').setStyle(ButtonStyle.Primary), new ButtonBuilder().setCustomId('close-ticket').setLabel('🔒 Close').setStyle(ButtonStyle.Danger))] });
    await i.editReply({ content: `✅ Ticket created: ${tc}` }); return;
  }

  if (customId === 'claim-ticket') {
    if (!member.permissions.has(PermissionFlagsBits.ManageMessages)) return i.reply({ content: '❌ No permission.', ephemeral: true });
    const t = ticketData[guild.id]?.[i.channel.id];
    if (!t) return i.reply({ content: '❌ Not a ticket channel.', ephemeral: true });
    if (t.claimedBy) return i.reply({ content: `❌ Already claimed by <@${t.claimedBy}>`, ephemeral: true });
    t.claimedBy = user.id; save('tickets.json', ticketData);
    await i.reply({ embeds: [embed({ color: C.green, description: `🙋 Claimed by ${user}` })] }); return;
  }

  if (customId === 'close-ticket') {
    const t = ticketData[guild.id]?.[i.channel.id];
    if (!t) return i.reply({ content: '❌ Not a ticket channel.', ephemeral: true });
    if (!member.permissions.has(PermissionFlagsBits.ManageMessages) && t.userId !== user.id) return i.reply({ content: '❌ No permission.', ephemeral: true });
    t.status = 'closed'; t.closedAt = new Date().toISOString(); t.closedBy = user.tag; save('tickets.json', ticketData);
    await i.reply({ embeds: [embed({ color: C.blood, description: `🔒 Closed by ${user}. Deletes in 10 seconds.` })] });
    const cId = i.channel.id, gId = guild.id;
    setTimeout(async () => { await i.channel.delete().catch(()=>{}); if(ticketData[gId]) delete ticketData[gId][cId]; save('tickets.json', ticketData); }, 10_000); return;
  }
}

// =============================================================
//  SELECT MENU
// =============================================================

async function handleSelect(i) {
  if (i.customId !== 'role-select') return;
  const avail = (roleMenus[i.guild.id]||[]).map(r=>r.id);
  const sel = i.values;
  const toAdd = sel.filter(id=>!i.member.roles.cache.has(id));
  const toRem = avail.filter(id=>i.member.roles.cache.has(id)&&!sel.includes(id));
  try {
    if (toAdd.length) await i.member.roles.add(toAdd);
    if (toRem.length) await i.member.roles.remove(toRem);
    const addN = toAdd.map(id=>i.guild.roles.cache.get(id)?.name).filter(Boolean);
    const remN = toRem.map(id=>i.guild.roles.cache.get(id)?.name).filter(Boolean);
    let desc = '';
    if (addN.length) desc += `✅ Added: ${addN.map(n=>`**${n}**`).join(', ')}\n`;
    if (remN.length) desc += `❌ Removed: ${remN.map(n=>`**${n}**`).join(', ')}`;
    await i.reply({ embeds: [embed({ color: C.green, description: desc || 'No changes.' })], ephemeral: true });
  } catch { await i.reply({ content: '❌ Failed to update roles.', ephemeral: true }); }
}

// =============================================================
//  PREFIX COMMANDS
// =============================================================

async function handlePrefix(msg) {
  if (!msg.content.startsWith(PREFIX)) return;
  const args = msg.content.slice(PREFIX.length).trim().split(/\s+/);
  const cmd  = args.shift().toLowerCase();
  const { guild, member, author, channel } = msg;
  const isMod   = member.permissions.has(PermissionFlagsBits.ManageMessages);
  const isAdmin = member.permissions.has(PermissionFlagsBits.Administrator);
  const reply = txt => channel.send(txt).catch(()=>{});
  const ok    = txt => reply(`✅ ${txt}`);
  const err   = txt => reply(`❌ ${txt}`);

  async function resolveMember(str) { if(!str) return null; const id=str.replace(/[<@!>]/g,''); return guild.members.fetch(id).catch(()=>null); }
  async function resolveUser(str)   { if(!str) return null; const id=str.replace(/[<@!>]/g,''); return client.users.fetch(id).catch(()=>null); }

  try {
    if (cmd === 'purge' || cmd === 'clear') {
      if (!isMod) return err('You need Manage Messages permission.');
      const amount = parseInt(args[0]);
      if (isNaN(amount)||amount<1||amount>100) return err('Use `,purge 10`');
      await msg.delete().catch(()=>{});
      const fetched = await channel.messages.fetch({ limit: 100 });
      const cutoff  = Date.now() - 14*24*60*60*1000;
      const fresh   = [...fetched.values()].filter(m=>m.createdTimestamp>cutoff).slice(0,amount);
      if (!fresh.length) return err('No deletable messages found.');
      const deleted = await channel.bulkDelete(fresh, true);
      const notice  = await channel.send(`✅ Deleted **${deleted.size}** messages.`);
      setTimeout(() => notice.delete().catch(()=>{}), 4000);
    }
    else if (cmd === 'ban') {
      if (!isAdmin) return err('You need Administrator permission.');
      const target = await resolveMember(args[0]); if(!target) return err('User not found. Use `,ban @user reason`');
      if (!target.bannable) return err('I cannot ban that user.');
      const reason = args.slice(1).join(' ') || 'No reason';
      await target.ban({ reason });
      const e = embed({ color: C.blood, title: '🔨 Banned', fields: [{ name: 'User', value: target.user.tag, inline: true }, { name: 'Mod', value: author.tag, inline: true }, { name: 'Reason', value: reason }] });
      channel.send({ embeds: [e] }); logMod(guild, e);
    }
    else if (cmd === 'kick') {
      if (!isMod) return err('You need Kick Members permission.');
      const target = await resolveMember(args[0]); if(!target) return err('User not found.');
      if (!target.kickable) return err('Cannot kick that user.');
      const reason = args.slice(1).join(' ') || 'No reason';
      await target.kick(reason);
      const e = embed({ color: C.red, title: '👢 Kicked', fields: [{ name: 'User', value: target.user.tag, inline: true }, { name: 'Mod', value: author.tag, inline: true }, { name: 'Reason', value: reason }] });
      channel.send({ embeds: [e] }); logMod(guild, e);
    }
    else if (cmd === 'warn') {
      if (!isMod) return err('You need Manage Messages permission.');
      const target = await resolveUser(args[0]); if(!target) return err('User not found.');
      const reason = args.slice(1).join(' '); if(!reason) return err('Provide a reason. `,warn @user reason`');
      if (!warnings[target.id]) warnings[target.id] = [];
      warnings[target.id].push({ reason, mod: author.tag, date: new Date().toISOString(), guild: guild.id });
      save('warnings.json', warnings);
      const cnt = warnings[target.id].filter(w=>w.guild===guild.id).length;
      const e = embed({ color: C.yellow, title: '⚠️ Warning', fields: [{ name: 'User', value: target.tag, inline: true }, { name: 'Mod', value: author.tag, inline: true }, { name: 'Reason', value: reason }, { name: 'Total', value: cnt.toString(), inline: true }] });
      channel.send({ embeds: [e] }); logMod(guild, e);
      target.send({ embeds: [embed({ color: C.yellow, title: `⚠️ Warning in ${guild.name}`, fields: [{ name: 'Reason', value: reason }] })] }).catch(()=>{});
      const gm = guild.members.cache.get(target.id);
      if (gm && cnt === 3) { await gm.timeout(3_600_000, 'Auto: 3 warnings').catch(()=>{}); channel.send('⚠️ Auto-timeout: 3 warnings.'); }
      if (gm && cnt >= 5)  { await gm.ban({ reason: 'Auto: 5+ warnings' }).catch(()=>{}); channel.send('🔨 Auto-ban: 5 warnings.'); }
    }
    else if (cmd === 'warnings') {
      if (!isMod) return err('No permission.');
      const target = await resolveUser(args[0]); if(!target) return err('User not found.');
      const list = (warnings[target.id]||[]).filter(w=>w.guild===guild.id);
      if (!list.length) return channel.send({ embeds: [embed({ color: C.green, description: `${target.tag} has no warnings.` })] });
      channel.send({ embeds: [embed({ color: C.yellow, title: `⚠️ Warnings — ${target.tag}`, description: `**${list.length}** total`, fields: list.slice(-10).map((w,idx)=>({ name: `#${idx+1}`, value: `**Reason:** ${w.reason}\n**By:** ${w.mod}`, inline: true })) })] });
    }
    else if (cmd === 'clearwarnings' || cmd === 'clearwarn') {
      if (!isMod) return err('No permission.');
      const target = await resolveUser(args[0]); if(!target) return err('User not found.');
      warnings[target.id] = (warnings[target.id]||[]).filter(w=>w.guild!==guild.id); save('warnings.json', warnings);
      ok(`Cleared warnings for **${target.tag}**`);
    }
    else if (cmd === 'timeout' || cmd === 'mute') {
      if (!isMod) return err('No permission.');
      const target = await resolveMember(args[0]); if(!target) return err('User not found.');
      const ms = parseTime(args[1]); if(!ms) return err('Use `,timeout @user 10m reason`');
      const reason = args.slice(2).join(' ') || 'No reason';
      await target.timeout(ms, reason);
      const e = embed({ color: C.yellow, title: '⏱️ Timed Out', fields: [{ name: 'User', value: target.user.tag, inline: true }, { name: 'Duration', value: args[1], inline: true }, { name: 'Reason', value: reason }] });
      channel.send({ embeds: [e] }); logMod(guild, e);
    }
    else if (cmd === 'untimeout' || cmd === 'unmute') {
      if (!isMod) return err('No permission.');
      const target = await resolveMember(args[0]); if(!target) return err('User not found.');
      await target.timeout(null); ok(`Removed timeout from **${target.user.tag}**`);
    }
    else if (cmd === 'lock') {
      if (!isMod) return err('No permission.');
      const reason = args.join(' ') || 'No reason';
      await channel.permissionOverwrites.edit(guild.id, { SendMessages: false });
      channel.send({ embeds: [embed({ color: C.blood, title: '🔒 Locked', description: `Locked by ${author}. **Reason:** ${reason}` })] });
    }
    else if (cmd === 'unlock') {
      if (!isMod) return err('No permission.');
      await channel.permissionOverwrites.edit(guild.id, { SendMessages: null });
      channel.send({ embeds: [embed({ color: C.green, title: '🔓 Unlocked', description: `Unlocked by ${author}.` })] });
    }
    else if (cmd === 'slowmode') {
      if (!isMod) return err('No permission.');
      const secs = parseInt(args[0]); if(isNaN(secs)) return err('Use `,slowmode 10`');
      await channel.setRateLimitPerUser(secs); ok(secs===0?'Slowmode disabled.': `Slowmode set to **${secs}s**.`);
    }
    else if (cmd === 'giverole') {
      if (!isMod) return err('No permission.');
      const target = await resolveMember(args[0]); if(!target) return err('User not found.');
      const roleId = args[1]?.replace(/[<@&>]/g,''); const role = guild.roles.cache.get(roleId); if(!role) return err('Role not found.');
      await target.roles.add(role); ok(`Gave **${role.name}** to **${target.user.tag}**`);
    }
    else if (cmd === 'removerole') {
      if (!isMod) return err('No permission.');
      const target = await resolveMember(args[0]); if(!target) return err('User not found.');
      const roleId = args[1]?.replace(/[<@&>]/g,''); const role = guild.roles.cache.get(roleId); if(!role) return err('Role not found.');
      await target.roles.remove(role); ok(`Removed **${role.name}** from **${target.user.tag}**`);
    }
    else if (cmd === 'nick') {
      if (!isMod) return err('No permission.');
      const target = await resolveMember(args[0]); if(!target) return err('User not found.');
      const nick = args.slice(1).join(' ') || null; await target.setNickname(nick);
      ok(nick?`Nickname set to **${nick}**`:`Reset nickname`);
    }
    else if (cmd === 'say') {
      if (!isMod) return err('No permission.');
      const text = args.join(' '); if(!text) return err('Provide a message.');
      await msg.delete().catch(()=>{}); channel.send(text);
    }
    else if (cmd === 'announce') {
      if (!isMod) return err('No permission.');
      const text = args.join(' '); if(!text) return err('Provide a message.');
      await msg.delete().catch(()=>{});
      channel.send({ embeds: [embed({ color: C.orange, title: '📢 Announcement', description: text, footer: { text: `Announced by ${author.tag}` } })] });
    }
    else if (cmd === 'rank') {
      const target = args[0] ? await resolveUser(args[0]) : author;
      const key = `${guild.id}-${target.id}`, d = levels[key] || { xp: 0, level: 0 };
      const allG = Object.entries(levels).filter(([k])=>k.startsWith(guild.id)).sort(([,a],[,b])=>b.xp-a.xp);
      const pos  = allG.findIndex(([k])=>k===key)+1;
      channel.send({ embeds: [embed({ color: C.orange, title: `📊 ${target.username}'s Rank`, thumbnail: target.displayAvatarURL({ dynamic: true }), fields: [{ name: '🏆 Rank', value: `#${pos||'?'}`, inline: true }, { name: '⭐ Level', value: d.level.toString(), inline: true }, { name: '✨ XP', value: d.xp.toString(), inline: true }] })] });
    }
    else if (cmd === 'afk') {
      const reason = args.join(' ') || '';
      afkUsers[author.id] = { reason, time: Date.now(), tag: author.tag }; save('afk.json', afkUsers);
      await msg.delete().catch(()=>{});
      const m = await channel.send({ embeds: [embed({ color: C.yellow, description: `💤 ${author} is now AFK${reason?` — *${reason}*`:''}.` })] });
      setTimeout(() => m.delete().catch(()=>{}), 5000);
    }
    else if (cmd === 'birthday' || cmd === 'bday') {
      const sub = args[0]?.toLowerCase();
      if (sub === 'set') {
        const day = parseInt(args[1]), month = parseInt(args[2]);
        if (!day||!month||day<1||day>31||month<1||month>12) return err('Use `,birthday set <day> <month>`');
        birthdays[author.id] = { date: `${month}-${day}`, tag: author.tag }; save('birthdays.json', birthdays);
        ok(`Birthday set to **${day}/${month}**!`);
      } else if (sub === 'remove') {
        delete birthdays[author.id]; save('birthdays.json', birthdays); ok('Birthday removed.');
      } else { err('Use `,birthday set <day> <month>` or `,birthday remove`'); }
    }
    else if (cmd === 'perk') {
      const input = args.join(' ').toLowerCase();
      const perk = DBD_PERKS[input] || Object.entries(DBD_PERKS).find(([k])=>k.includes(input)||input.includes(k))?.[1];
      if (!perk) return err(`Perk not found. Try \`,perk dead hard\` or \`,perk bbq\``);
      channel.send({ embeds: [embed({ color: perk.type==='Survivor'?C.orange:C.blood, title: perk.name, thumbnail: perk.icon, fields: [{ name: '👤 Type', value: perk.type, inline: true }, { name: '🏆 Tier', value: perk.tier, inline: true }, { name: '📋 Effect', value: perk.description, inline: false }, { name: '💡 Tip', value: perk.tip, inline: false }], footer: { text: 'Dead by Daylight · Perk Info' } })] });
    }
    else if (cmd === 'killer') {
      const input = args.join(' ').toLowerCase();
      const killer = DBD_KILLERS[input] || Object.entries(DBD_KILLERS).find(([k,v])=>k.includes(input)||v.name.toLowerCase().includes(input))?.[1];
      if (!killer) return err('Killer not found. Try `,killer nurse` or `,killer blight`');
      channel.send({ embeds: [embed({ color: C.blood, title: `🔪 ${killer.name}`, fields: [{ name: '⚡ Power', value: killer.power, inline: true }, { name: '🏆 Tier', value: killer.tier, inline: true }, { name: '📋 Overview', value: killer.description, inline: false }, { name: '💡 Tip', value: killer.tip, inline: false }], footer: { text: 'Dead by Daylight · 2026 Meta' } })] });
    }
    else if (cmd === 'help') {
      channel.send({ embeds: [embed({ color: C.orange, title: '📚 Seine Bot — Prefix Commands',
        description: 'Prefix is `,`',
        fields: [
          { name: '🩸 DBD', value: '`,perk` `,killer`', inline: false },
          { name: '🛡️ Moderation', value: '`,ban` `,kick` `,warn` `,warnings` `,clearwarn` `,timeout` `,untimeout` `,purge` `,lock` `,unlock` `,slowmode` `,giverole` `,removerole` `,nick`', inline: false },
          { name: '📢 Utility', value: '`,say` `,announce` `,rank` `,afk` `,birthday` `,help`', inline: false }
        ]
      })] });
    }
  } catch (err) { console.error('[PREFIX ERROR]', err.message); channel.send(`❌ Error: ${err.message}`).catch(()=>{}); }
}

// =============================================================
//  START
// =============================================================

client.login(config.token);
