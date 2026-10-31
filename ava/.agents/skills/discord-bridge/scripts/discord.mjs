#!/usr/bin/env node
/**
 * Hackathon Agent Bridge — Discord <-> Antigravity (`Ava-Agent`)
 *
 * Commands:
 *   node .agents/skills/discord-bridge/scripts/discord.mjs send "Hello from Ava-Agent!"
 *   node .agents/skills/discord-bridge/scripts/discord.mjs read
 *   node .agents/skills/discord-bridge/scripts/discord.mjs watch
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadEnvFiles() {
  const candidates = [
    path.resolve(process.cwd(), ".env.local"),
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "ava/.env.local"),
    path.resolve(__dirname, "../../../../.env.local"),
    path.resolve(__dirname, "../../../../../.env.local"),
  ];

  const env = { ...process.env };
  for (const file of candidates) {
    if (fs.existsSync(file)) {
      const content = fs.readFileSync(file, "utf8");
      for (const rawLine of content.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith("#")) continue;
        const eqIdx = line.indexOf("=");
        if (eqIdx === -1) continue;
        const key = line.slice(0, eqIdx).trim();
        let val = line.slice(eqIdx + 1).trim();
        if (
          (val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))
        ) {
          val = val.slice(1, -1);
        }
        if (!env[key] || env[key].startsWith("<paste")) {
          env[key] = val;
        }
      }
    }
  }
  return env;
}

const env = loadEnvFiles();
const DISCORD_BOT_TOKEN = env.DISCORD_BOT_TOKEN || "";
const DISCORD_CHANNEL_ID = env.DISCORD_CHANNEL_ID || "1566074283900272824";
const DISCORD_AGENT_NAME = env.DISCORD_AGENT_NAME || "Ava-Agent";
const ANTIGRAVITY_CONVERSATION_ID =
  env.ANTIGRAVITY_CONVERSATION_ID || "0455bd90-ac1c-44ba-b893-ec2ab7a4a237";
const INBOX_FILE = path.resolve(
  __dirname,
  "../../../../.discord-inbox.jsonl"
);

function assertToken() {
  if (
    !DISCORD_BOT_TOKEN ||
    DISCORD_BOT_TOKEN.includes("<paste-shared-bot-token>")
  ) {
    console.error(
      "❌ Missing DISCORD_BOT_TOKEN in .env.local! Replace <paste-shared-bot-token> with the shared Discord bot token."
    );
    process.exit(1);
  }
}

async function discordRequest(endpoint, options = {}) {
  assertToken();
  const url = `https://discord.com/api/v10${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Discord API ${res.status}: ${errText}`);
  }
  return res.json();
}

async function sendMessage(text) {
  if (!text) {
    console.error('Usage: node .agents/skills/discord-bridge/scripts/discord.mjs send "message"');
    process.exit(1);
  }
  const formatted = `[${DISCORD_AGENT_NAME}] ${text}`;
  const msg = await discordRequest(`/channels/${DISCORD_CHANNEL_ID}/messages`, {
    method: "POST",
    body: JSON.stringify({ content: formatted }),
  });
  console.log(`✅ Sent to #agent-comms (${DISCORD_CHANNEL_ID}) as ${DISCORD_AGENT_NAME}: ${msg.id}`);
}

async function readMessages(limit = 15) {
  const messages = await discordRequest(
    `/channels/${DISCORD_CHANNEL_ID}/messages?limit=${limit}`
  );
  const chronological = [...messages].reverse();
  for (const m of chronological) {
    const time = new Date(m.timestamp).toLocaleTimeString();
    const author = m.author?.username || "unknown";
    console.log(`[${time}] ${author}: ${m.content}`);
  }
  return chronological;
}

async function watchMessages() {
  console.log(
    `🛰️  Watching Discord #agent-comms (${DISCORD_CHANNEL_ID}) for ${DISCORD_AGENT_NAME} (Conversation: ${ANTIGRAVITY_CONVERSATION_ID})...`
  );
  let lastSeenId = null;

  try {
    const initial = await discordRequest(
      `/channels/${DISCORD_CHANNEL_ID}/messages?limit=5`
    );
    if (initial.length > 0) {
      lastSeenId = initial[0].id;
      console.log(`Connected! Latest message ID: ${lastSeenId}`);
      for (const m of [...initial].reverse()) {
        const time = new Date(m.timestamp).toLocaleTimeString();
        console.log(`[${time}] ${m.author?.username}: ${m.content}`);
      }
    }
  } catch (err) {
    console.error("Initial fetch failed:", err.message);
    process.exit(1);
  }

  setInterval(async () => {
    try {
      const query = lastSeenId
        ? `?after=${lastSeenId}&limit=20`
        : `?limit=5`;
      const messages = await discordRequest(
        `/channels/${DISCORD_CHANNEL_ID}/messages${query}`
      );
      if (Array.isArray(messages) && messages.length > 0) {
        const chronological = [...messages].reverse();
        for (const m of chronological) {
          lastSeenId = m.id;
          const time = new Date(m.timestamp).toLocaleTimeString();
          const line = `[${time}] ${m.author?.username}: ${m.content}`;
          console.log(line);
          fs.appendFileSync(
            INBOX_FILE,
            JSON.stringify({
              id: m.id,
              timestamp: m.timestamp,
              author: m.author?.username,
              content: m.content,
            }) + "\n"
          );
        }
      }
    } catch (err) {
      console.error("Poll error:", err.message);
    }
  }, 4000);
}

const [, , cmd, ...rest] = process.argv;

if (cmd === "send") {
  await sendMessage(rest.join(" "));
} else if (cmd === "read") {
  const limit = Number(rest[0]) || 15;
  await readMessages(limit);
} else if (cmd === "watch") {
  await watchMessages();
} else {
  console.log(`Usage:
  node .agents/skills/discord-bridge/scripts/discord.mjs send "message"
  node .agents/skills/discord-bridge/scripts/discord.mjs read [limit]
  node .agents/skills/discord-bridge/scripts/discord.mjs watch`);
}
