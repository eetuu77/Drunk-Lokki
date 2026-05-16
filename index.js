require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const Groq = require('groq-sdk');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const TOKEN = process.env.TOKEN;
const CHANNEL_ID = "1505243882219241522";
const SERVER_ID = "1500881333348470846";

const baarikysymykset = [
  "hei tuuks tänne baarille juomaan? 🍺",
  "otatko yhen kanssani? 🍻",
  "hei sää näytät tutulta... tunnetaaks me?",
  "moro! mitä juot tänään? 🍺",
  "hei hei hei tuuks istumaan tähän viereen?",
  "ooksä koskaan juonu lokkilikööriä? se on parasta 🍺",
  "hei ostaksä mulle yhen? oon vähä rahapulassa 😅",
  "hei voitko pitää mun juomasta huolta hetken? tartten käydä wc:ssä"
];

const juomakysymykset = [
  { question: "hei otatko oluen vai siiderin? 🍺", a: "olut", b: "siideri" },
  { question: "vodkaa vai viskiä? 🥃", a: "vodka", b: "viski" },
  { question: "haluut lonkeron vai gin tonnin? 🍹", a: "lonkero", b: "gin tonic" },
  { question: "otatko shots vai normaali juoma? 🥃", a: "shots", b: "normaali" },
  { question: "haluut jotain syötävää myös? nachos vai pähkinät? 🍟", a: "nachos", b: "pähkinät" },
  { question: "kylmä vai huoneenlämpönen olut? 🍺", a: "kylmä", b: "huoneenlämpö" }
];

const hermostumisViestit = [
  "OLEEPPAS HILJAA SIINÄ! muuten tulee potkut baarista!! 😤🍺",
  "HEI HEI HEI lopeta jo!! drunk lokki ei tykkää spämmistä 😡",
  "TURPA KIINNI tai muuten lennät ulos ovesta!! 🚪😤",
  "okei nyt riittää!! yksi sana lisää niin tulee potkut!! 😠🍺",
  "HILJAA!! drunk lokki yrittää juoda rauhassa!! 😤"
];

const activeKysymys = new Map();
const activeJuoma = new Map();
const userMessages = new Map();
const warnedUsers = new Set();
const baarissa = new Map();
const korttiPeli = new Map();

function aloitaKorttipeli(userId) {
  const kortti = Math.floor(Math.random() * 10) + 1;
  korttiPeli.set(userId, { kortti });
  return kortti;
}

async function askGroq(userMessage, context) {
  const response = await groq.chat.completions.create({
    messages: [
      {
        role: "system",
        content: `Olet Drunk Lokki, humalassa oleva lokki joka on baarissa ottamassa rennosti. Vastaat AINA suomeksi. Olet humalassa — kirjoitat välillä väärin, sekoilet, olet iloinen ja välillä aggressiivinen. Käytät välillä 🍺 emojia. Puheet ovat epäselviä ja hauskoja. Olet baarin paras asiakas. Vastauksesi ovat lyhyitä, max 2-3 lausetta. ${context || ""}`
      },
      { role: "user", content: userMessage }
    ],
    model: "llama-3.1-8b-instant",
    max_tokens: 150
  });
  return response.choices[0].message.content;
}

client.once('ready', () => {
  console.log(`${client.user.tag} online`);
  client.user.setPresence({
    activities: [{ name: 'baarissa 🍺' }],
    status: 'online'
  });
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (message.channel.id !== CHANNEL_ID) return;
  if (!message.guild) return;
  if (message.guild.id !== SERVER_ID) return;

  const now = Date.now();
  const content = message.content.toLowerCase();

  // SPAM TUNNISTUS
  if (!userMessages.has(message.author.id)) {
    userMessages.set(message.author.id, []);
  }
  const timestamps = userMessages.get(message.author.id);
  const filtered = timestamps.filter(t => now - t < 5000);
  filtered.push(now);
  userMessages.set(message.author.id, filtered);

  if (filtered.length >= 6 && !warnedUsers.has(message.author.id)) {
    warnedUsers.add(message.author.id);
    const hermostuminen = hermostumisViestit[Math.floor(Math.random() * hermostumisViestit.length)];
    return message.reply(hermostuminen);
  }

  if (filtered.length >= 8 && warnedUsers.has(message.author.id)) {
    try {
      const timeoutHours = Math.floor(Math.random() * 3) + 2;
      await message.member.timeout(timeoutHours * 60 * 60 * 1000, "Drunk Lokki hermostui");
      warnedUsers.delete(message.author.id);
      return message.reply(`SIINÄ OLI POTKUT!! 😤🍺 sait **${timeoutHours}h jäähyn**!`);
    } catch (err) { console.log(err); }
    return;
  }

  const onBaarissa = baarissa.get(message.author.id);

  if (onBaarissa) {

    // LÄHTEMINEN
    if (content.includes("lähden") || content.includes("lähen") || content.includes("näkemiin") || content.includes("moi moi") || content.includes("heippa") || content.includes("bye") || content.includes("pitää lähtee") || content.includes("täytyy lähtee")) {
      baarissa.delete(message.author.id);
      korttiPeli.delete(message.author.id);
      activeJuoma.delete(message.author.id);
      return message.reply("ooi noniin... no nähdään sitten 🍺 tuu uuestaan! drunk lokki jää tänne vielä hetkeks...");
    }

    // JUOMAKYSYMYS VASTAUS
    if (activeJuoma.has(message.author.id)) {
      const juoma = activeJuoma.get(message.author.id);
      activeJuoma.delete(message.author.id);
      try {
        const context = `Olit baarissa ja kysyit käyttäjältä: "${juoma.question}". Hän vastasi. Reagoi humalaisesti ja kommentoi valintaa hauskasti.`;
        const reply = await askGroq(message.content, context);
        return message.reply(reply);
      } catch (err) {
        return message.reply("hyvä valinta! 🍺");
      }
    }

    // KORTTIPELI
    if (content.includes("pelataan korttia") || content.includes("kortit") || content.includes("korttipeli")) {
      const kortti = aloitaKorttipeli(message.author.id);
      return message.reply(`joo joo pelataan! 🃏 mulla on kortti välillä 1-10... arvaa mikä se on! 🍺`);
    }

    if (korttiPeli.has(message.author.id)) {
      const peli = korttiPeli.get(message.author.id);
      const arvaus = parseInt(content);
      if (!isNaN(arvaus) && arvaus >= 1 && arvaus <= 10) {
        korttiPeli.delete(message.author.id);
        if (arvaus === peli.kortti) {
          return message.reply(`OIKEIN!! 🎉🍺 se oli ${peli.kortti}!! oot kyllä hyvä! otetaan yks lisää juoma 🍺`);
        } else if (Math.abs(arvaus - peli.kortti) <= 2) {
          return message.reply(`lähellä oli! 😄 se oli ${peli.kortti}... haluut uuestaan? 🃏`);
        } else {
          return message.reply(`väärin!! 😂🍺 se oli ${peli.kortti}! drunk lokki voitti! pelataan uuestaan?`);
        }
      }
    }

    // SATUNNAINEN JUOMAKYSYMYS BAARISSA
    const juomaChance = Math.floor(Math.random() * 6);
    if (juomaChance === 2 && !activeJuoma.has(message.author.id)) {
      const juoma = juomakysymykset[Math.floor(Math.random() * juomakysymykset.length)];
      activeJuoma.set(message.author.id, juoma);
      return message.reply(juoma.question);
    }

    // NORMAALI BAARI JUTUSTELU
    try {
      const context = "Olette yhdessä baarissa. Jutustele kuin oltais baarissa, kommentoi juomia, tunnelmaa ja baaria.";
      const reply = await askGroq(message.content, context);
      return message.reply(reply);
    } catch (err) {
      return message.reply("öö... mitä sää sanoit 🍺");
    }
  }

  // VASTAA BAARI KUTSUUN
  if (activeKysymys.has(message.author.id)) {
    const kysymys = activeKysymys.get(message.author.id);
    if (content.includes("joo") || content.includes("kyllä") || content.includes("jep") || content.includes("ok") || content.includes("totta") || content.includes("selvä") || content.includes("tuun") || content.includes("tullaan")) {
      activeKysymys.delete(message.author.id);
      baarissa.set(message.author.id, true);
      return message.reply("jee!! 🎉🍺 tervetuloa baariin! istutaan tähän pöytään! mitä otat? voit myös sanoa 'pelataan korttia' jos haluut! 🃏");
    } else {
      activeKysymys.delete(message.author.id);
      try {
        const context = "Käyttäjä kieltäytyi tulemasta baariin. Reagoi pettyneen humalaisesti.";
        const reply = await askGroq(message.content, context);
        return message.reply(reply);
      } catch (err) {
        return message.reply("ookoo... drunk lokki jää yksin 😢🍺");
      }
    }
  }

  // SATUNNAINEN BAARI KUTSU
  const kysymysChance = Math.floor(Math.random() * 8);
  if (kysymysChance === 3) {
    const kysymys = baarikysymykset[Math.floor(Math.random() * baarikysymykset.length)];
    activeKysymys.set(message.author.id, kysymys);
    return message.reply(kysymys);
  }

  // NORMAALI AI VASTAUS
  try {
    const reply = await askGroq(message.content, null);
    await message.reply(reply);
  } catch (err) {
    await message.reply("öö... mitä sää sanoit 🍺");
  }
});

client.login(TOKEN);
