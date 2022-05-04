require('dotenv').config();
const express = require('express');
const { Client, Intents, InteractionWebhook, MessageEmbed, Message, MessageActionRow, MessageButton } = require('discord.js');
const logger = require('morgan');
const SQLite = require('better-sqlite3');
const path = require('path');
const uuid = require('uuid');
const { arch } = require('os');
const { codeBlock } = require('@discordjs/builders');
const { time } = require('console');
const sql = new SQLite('verify.db');
const app = express();
const client = new Client({
    intents: [
        Intents.FLAGS.GUILDS,
        Intents.FLAGS.GUILD_MEMBERS,
        Intents.FLAGS.GUILD_INTEGRATIONS,
        Intents.FLAGS.GUILD_MESSAGES
    ],
    allowedMentions: {
        parse: [],
        repliedUser: false
    }
});
app.use(logger('dev'));
app.use(express.json());

app.get('/:id', async (req, res) => {
    try {
        const verify = sql.prepare('SELECT * FROM verifys WHERE id = ?').get(req.params.id);
        if (!verify) return res.status(400).end('Bad Request');
        else if (verify.time) return res.status(200).sendFile(path.join(__dirname, 'alreadyverifyed.html'));
        const member = await client.guilds.cache.get('794380572323086358').members.fetch(verify.userid);
        await member.roles.add('823135313089003522', 'Web Verify');
        sql.prepare('UPDATE verifys SET time = ? WHERE id = ?').run(Date.now(), verify.id);
        res.status(201).sendFile(path.join(__dirname, 'success.html'));
        client.channels.cache.get('910406325559771186').send({
            embeds: [
                new MessageEmbed()
                    .setTitle('Web認証通知')
                    .addField('Web認証したユーザー名', member.user.tag, true)
                    .addField('Web認証したユーザーID', member.user.id, true)
                    .addField('認証キー', verify.id, true)
                    .setImage(member.user.avatarURL({ format: 'webp' }))
                    .setColor('RANDOM')
                    .setTimestamp()
            ]
        });
    } catch (error) {
        res.status(500).end('Internal Server Error');
    }
});

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);

    if (!sql.prepare('SELECT count(*) FROM sqlite_master WHERE type=\'table\' AND name = \'verifys\';').get()['count(*)']) {
        sql.prepare('CREATE TABLE verifys (id TEXT PRIMARY KEY, userid TEXT, time INTEGER);').run();
        sql.prepare('CREATE UNIQUE INDEX idx_verifys_id ON verifys (id);').run();
    }

    sql.pragma('synchronous = 1');
    sql.pragma('journal_mode = wal');

});

client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;
    if (interaction.customId === 'verify') {
        await interaction.deferReply({ ephemeral: true });
        const data = sql.prepare('SELECT * FROM verifys WHERE userid = ?').get(interaction.user.id);
        if (data) {
            if (data.time) return await interaction.followUp('既に認証済みです');
            return await interaction.followUp(`http://localhost:3000/${data.id}`);
        }
        const uuidv4 = uuid.v4();
        sql.prepare('INSERT INTO verifys (id, userid) VALUES (?, ?)').run(uuidv4, interaction.user.id);
        await interaction.followUp(`http://localhost:3000/${uuidv4}`);
    }
});

client.on('messageCreate', async message => {
    if (message.author.bot || message.system || !message.guild) return;
    if (message.content.startsWith('!verify')) {
        await message.channel.send({
            embeds: [
                new MessageEmbed()
                    .setTitle('Web認証')
                    .setDescription('<@&823135313089003522>役職を入手するには、下のボタンを押して認証を開始します')
            ],
            components: [
                new MessageActionRow()
                    .addComponents(
                        new MessageButton()
                            .setCustomId('verify')
                            .setLabel('認証')
                            .setStyle('PRIMARY')
                    )
            ]
        });
    }
    else if (message.content.startsWith('!find')) {
        const user = message.mentions.users.first();
        if (!user) return;
        const verify = sql.prepare('SELECT * FROM verifys WHERE userid = ?').get(user.id);
        if (!verify) return await message.reply('User Data Not Found');
        else if (verify.time) {
            const time = new Date(verify.time);
            await message.reply(codeBlock(`ユーザー: ${user.tag}\nWeb認証済み: はい\nWeb認証時刻: ${time.getFullYear()}年${time.getMonth() + 1}月${time.getDate()}日${time.getHours()}時${time.getMinutes()}分${time.getSeconds()}秒\n認証キー: ${verify.id}`));
        }

    }
});

process.on('SIGINT', () => process.exit());
process.on('exit', (code) => {
    sql.close();
    console.info(`プロセスはコード${code}で終了しました`)
});
process.on('unhandledRejection', (err) => {
    console.error(err);
});

app.listen(3000);
client.login('ODM3NzU0OTgzOTI2NzI2Njg3.YIxKIA.X5OB9bOEYKl0W1cv3wB4NVp08d8');