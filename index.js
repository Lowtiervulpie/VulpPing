require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder
} = require('discord.js');
const fetch = global.fetch;
const express = require('express');
const crypto = require('crypto'); // built-in

// ===== VULPPING CONFIG =====
const dmCooldown = new Map();

const vulpMessages = [
  "⚠️ VulpPing detected movement.",
  "🦊 The fox is active.",
  "🚨 VulpPing alert triggered.",
  "🔥 Chaos signal received.",
  "📡 VulpPing just fired."
];

// ===== DISCORD CLIENT =====
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildMembers
  ],
  partials: [
    Partials.Message,
    Partials.Channel,
    Partials.Reaction
  ]
});

// ===== CONFIG =====
const MESSAGE_ID = '1483494232340828221';
const ROLE_ID = process.env.ROLE_ID;

// ===== STATE =====
let isLive = false;

// ===== EXPRESS SERVER =====
const app = express();
app.use(express.json());

app.get('/', (req, res) => {
	res.status(200).send('VulpPing alive');
});

app.get('/status', (req, res) => {
  res.json({
    server: "online",
    discord: client.isReady() ? "connected" : "not ready",
    twitch_user: process.env.TWITCH_USERNAME,
    callback: process.env.CALLBACK_URL,
    uptime_seconds: Math.floor(process.uptime())
  });
});
// ===== READY =====
client.once('clientReady', () => {
  console.log(`🦊 VulpSignal ULTRA running as ${client.user.tag}`);
});
// ===== WEBHOOK =====
app.get('/webhook', (req, res) => {
  res.status(200).send('Webhook ready');
});
app.post('/webhook', (req, res) => {
  try {
    const messageType = req.headers['twitch-eventsub-message-type'];

    console.log('📩 Webhook received:', messageType);
    console.log('📦 Body:', JSON.stringify(req.body));

    // 🔑 REQUIRED FOR TWITCH VERIFICATION
    if (messageType === 'webhook_callback_verification') {
      const challenge = req.body?.challenge;

      if (!challenge) {
        console.error('❌ No challenge received');
        return res.sendStatus(400);
      }

      console.log('✅ Sending challenge back to Twitch');
      return res.status(200).send(challenge);
    }

    // 🔔 LIVE EVENT
    if (
      messageType === 'notification' &&
      req.body?.subscription?.type === 'stream.online'
    ) {
      console.log('🚨 STREAM WENT LIVE EVENT RECEIVED');
      handleLive(req.body.event);
    }

    // ALWAYS respond
    res.sendStatus(200);

  } catch (err) {
    console.error('❌ Webhook crashed:', err);
    res.sendStatus(200); // <- important: don't break Twitch
  }
});
// ===== LIVE HANDLER =====
async function handleLive(stream) {
  try {
	console.log("CHANNEL_ID FROM ENV:", process.env.CHANNEL_ID);
	const channel = await client.channels.fetch(process.env.CHANNEL_ID);
    	const guild = channel.guild;
    	const role = guild.roles.cache.get(process.env.ROLE_ID);

    const randomLine = vulpMessages[Math.floor(Math.random() * vulpMessages.length)];

    const embed = new EmbedBuilder()
      .setColor(0xff6600)
      .setTitle("🦊 VulpPing Alert")
      .setURL(`https://twitch.tv/${process.env.TWITCH_USERNAME}`)
      .setDescription(`${randomLine}\n\n🔴 Stream is LIVE`)
      .addFields(
        { name: "🎮 Game", value: stream?.game_name || "Unknown", inline: true },
        { name: "📝 Title", value: stream?.title || "No title", inline: false }
      )
      .setThumbnail(`https://static-cdn.jtvnw.net/previews-ttv/live_user_${process.env.TWITCH_USERNAME}-320x180.jpg${Date.now()}`)
      .setFooter({ text: "VulpPing 📡" });

    await channel.send({
      content: `<@&${process.env.ROLE_ID}>`,
      embeds: [embed]
    });

    console.log("🚨 VulpPing alert sent");

    // ===== DM SYSTEM WITH COOLDOWN =====
    role.members.forEach(async (member) => {
      const lastDM = dmCooldown.get(member.id) || 0;
      const now = Date.now();

      if (now - lastDM < 1000 * 60 * 30) return; // 30 min cooldown

      try {
       await member.send(
 	 `🦊 **VulpPing Notification**\n\n` +
 	 `🔴 LowTierVulpie is LIVE\n\n` +
 	 `🎮 ${stream?.game_name || "Unknown"}\n` +
 	 `📝 ${stream?.title || "No title"}\n\n` +
 	 `👉 https://twitch.tv/${process.env.TWITCH_USERNAME}`
	);

        dmCooldown.set(member.id, now);

      } catch {
        console.log(`Couldn't DM ${member.user.username}`);
      }
    });

  } catch (err) {
    console.error("Live handler error:", err);
  }
}
// ===== REACTION ROLE ADD =====
client.on('messageReactionAdd', async (reaction, user) => {
  if (user.bot) return;
  if (reaction.partial) await reaction.fetch();

  if (reaction.message.id === MESSAGE_ID && reaction.emoji.name === '🦊') {
    const member = await reaction.message.guild.members.fetch(user.id);
    await member.roles.add(ROLE_ID);

    try {
      await user.send("🦊 You will now be notified when Vulpie goes live via ping. Welcome to the Den!");
    } catch {}
  }
});

// ===== REACTION ROLE REMOVE =====
client.on('messageReactionRemove', async (reaction, user) => {
  if (user.bot) return;
  if (reaction.partial) await reaction.fetch();

  if (reaction.message.id === MESSAGE_ID && reaction.emoji.name === '🦊') {
    const member = await reaction.message.guild.members.fetch(user.id);
    await member.roles.remove(ROLE_ID);
  }
});
// ===== TWITCH EVENTSUB ENSURE =====
async function ensureTwitchSub() {
  try {
    console.log("🔎 Checking Twitch EventSub subscription...");

    const tokenRes = await fetch("https://id.twitch.tv/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        client_id: process.env.TWITCH_CLIENT_ID,
        client_secret: process.env.TWITCH_CLIENT_SECRET,
        grant_type: "client_credentials"
      })
    });

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    const subRes = await fetch("https://api.twitch.tv/helix/eventsub/subscriptions", {
      method: "POST",
      headers: {
        "Client-ID": process.env.TWITCH_CLIENT_ID,
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        type: "stream.online",
        version: "1",
        condition: {
          broadcaster_user_id: "135382594"
        },
        transport: {
          method: "webhook",
          callback: process.env.CALLBACK_URL,
          secret: process.env.TWITCH_EVENTSUB_SECRET
        }
      })
    });

    const subData = await subRes.json();

    console.log("📡 EventSub response:", JSON.stringify(subData));

  } catch (err) {
    console.error("❌ EventSub ensure failed:", err);
  }
}
// ===== START SERVER FUNCTION =====
function startServer() {
const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`⚡ Server running on port ${PORT}`);

ensureTwitchSub();
});
}
// start Express
startServer();
// ===== LOGIN =====
client.login(process.env.DISCORD_TOKEN);