const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const mongoose = require('mongoose');

const app = express();
app.use(bodyParser.json());

// ⚙️ CONFIGURATION
const PAGE_ACCESS_TOKEN = "EAAcLptP3AhgBRVaudVLZCUnjnZCNvMNBjsN1vtW3circdCouQQit1r6oEp3kMVbRJJUplqd6YFFqPySY15rksGpZClkFbOItZCf7Vkxf7ZBctmxGAxghQDfGYWaP7fYLNROXH6UDCSWgttQYEHQqww7IOpZBxMNJLnX4dyWGH12cKlVtXuKlAQCSzlOAnLntvbfnZAmDAZDZD";
const VERIFY_TOKEN = "key";
const PORT = process.env.PORT || 10000;

// 📦 MEMORY STORAGE
let waitingQueue = [];
let activeChats = {};
let userMessageCount = {};
global.tempState = {};

// ==========================
// 🗄️ MONGODB CONNECTION
// ==========================
const mongoURI = "mongodb+srv://danielmojar84_db_user:nDG9hpTU0uHZtxYO@cluster0.wsk0egt.mongodb.net/?appName=Cluster0";

mongoose.connect(mongoURI)
.then(() => {
    console.log("✅ MongoDB Connected Successfully");
    announceUpdate(); 
})
.catch(err => console.log("❌ MongoDB Connection Error:", err));

// 📋 SCHEMA & MODEL
const userSchema = new mongoose.Schema({
    psid: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    age: { type: Number, required: true },
    role: { type: String, default: "member" },
    isBanned: { type: Boolean, default: false }
});

const User = mongoose.model("User", userSchema);

// ==========================
// 🚫 PROFANITY FILTER (REVEAL 1ST, 3RD, LAST)
// ==========================
const badWords = [
    "stupid", "idiot", "fuck", "shit", "bitch", "asshole", "dick", "pussy", "faggot", "bastard", 
    "porn", "hentai", "sex", "xxx", "cum", "milf", "cock", "slut", "whore", "nigga", "nigger",
    "tangina", "puta", "gago", "pucha", "putragis", "hayop", "bobo", "tanga", "kupal", "pakyu", 
    "dede", "bulbul", "burat", "bayag", "kantot", "iyot", "pepe", "puke", "etits", "salsal", 
    "jakol", "manyak", "pokpok", "bilat", "paltik", "tite", "titik", "utin"
];

function filterBadWords(text) {
    if (!text) return text;
    let filteredText = text;
    badWords.forEach(word => {
        const pattern = word.split('').map(char => {
            let v = char;
            if (char === 'a') v = '[a4@]';
            if (char === 'e') v = '[e3]';
            if (char === 'i') v = '[i1!]';
            if (char === 'o') v = '[o0]';
            if (char === 's') v = '[s5$]';
            if (char === 't') v = '[t7]';
            if (char === 'p') v = '[p|]';
            return v + '+';
        }).join('[\\s\\W\\._]*');
        
        const regex = new RegExp(pattern, 'gi');
        filteredText = filteredText.replace(regex, (matched) => {
            if (matched.length <= 2) return "*".repeat(matched.length);
            let result = "";
            for (let i = 0; i < matched.length; i++) {
                if (i === 0 || i === 2 || i === matched.length - 1) {
                    result += matched[i];
                } else { result += "*"; }
            }
            return result;
        });
    });
    return filteredText;
}

// ==========================
// 📢 ANNOUNCEMENT ON DEPLOY
// ==========================
async function announceUpdate() {
    try {
        const users = await User.find({}, 'psid');
        const message = `📢 BOT UPDATE\n────────────────────\nBot has been updated!\n\n✨ NEW FEATURES:\n- Added Ban System🚫\n- Fixed asterisk bad words (st*p*d style)\n\nConversations were reset. Reply 'chat' to find a new stranger!`;
        for (let user of users) { await sendMessage(user.psid, message); }
    } catch (e) { console.log("❌ Announcement Error"); }
}

// ==========================
// WEBHOOK VERIFICATION
// ==========================
app.get('/webhook', (req, res) => {
    if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === VERIFY_TOKEN) {
        res.status(200).send(req.query['hub.challenge']);
    } else { res.sendStatus(403); }
});

// ==========================
// HANDLE INCOMING MESSAGES
// ==========================
app.post('/webhook', async (req, res) => {
    const body = req.body;
    if (body.object === 'page') {
        body.entry.forEach(entry => {
            entry.messaging.forEach(async event => {
                const senderId = event.sender.id;
                if (event.read && activeChats[senderId]) {
                    await markSeen(activeChats[senderId]);
                    return;
                }
                const userData = await User.findOne({ psid: senderId });
                if (userData && userData.isBanned) return;
                await markSeen(senderId);

                if (event.message) {
                    const text = event.message.text;
                    const lowerText = text ? text.toLowerCase() : "";
                    let commandHandled = false;
                    
                    if (lowerText === "quit" || lowerText === "/profile" || lowerText === "chat") {
                        if (!userData && !tempState[senderId]) {
                            await sendMessage(senderId, `❌ ACCESS DENIED\n────────────────────\nYour profile is not yet initialized.\n\nPlease type /setinfo to register.`);
                            return;
                        }
                    }

                    if (lowerText === "quit") {
                        await handleQuit(senderId);
                        commandHandled = true;
                    } else if (lowerText.startsWith("/admin ") || lowerText.startsWith("/ban ") || lowerText.startsWith("/unban ") || lowerText.startsWith("/loginowner ") || lowerText === "/setinfo" || tempState[senderId]) {
                        await handleMessage(senderId, text, lowerText);
                        commandHandled = true;
                    }

                    if (commandHandled) return;

                    if (activeChats[senderId]) {
                        if (text && text.startsWith("http")) {
                            await sendMessage(activeChats[senderId], text);
                        } else if (event.message.attachments) {
                            const att = event.message.attachments[0];
                            if (['image', 'audio', 'video'].includes(att.type)) {
                                await sendAttachment(activeChats[senderId], att.type, att.payload.url);
                            }
                        } else if (text) {
                            userMessageCount[senderId] = (userMessageCount[senderId] || 0) + 1;
                            const cleanText = filterBadWords(text);
                            await sendMessage(activeChats[senderId], cleanText);
                        }
                    } else {
                        if (lowerText === "chat" || lowerText === "/profile") {
                            await handleMessage(senderId, text, lowerText);
                        } else if (!userData) {
                            await sendMessage(senderId, `👋 WELCOME\n────────────────────\nPlease type /setinfo to start\n\n📋 COMMANDS:\n/setinfo - Create/Update account\n/profile - View your profile\nchat - Find someone\nquit - End conversation`);
                        }
                    }
                }
            });
        });
        res.status(200).send('EVENT_RECEIVED');
    } else { res.sendStatus(404); }
});

// ==========================
// MAIN LOGIC
// ==========================
async function handleMessage(senderId, text, lowerText) {
    let userData = await User.findOne({ psid: senderId });

    if (lowerText === "/loginowner dan122012") {
        if (!userData) userData = new User({ psid: senderId, name: "Owner", age: 1 });
        userData.role = "owner";
        await userData.save();
        return sendMessage(senderId, "✅ AUTHENTICATION SUCCESS\n────────────────────\nYou are now logged in as OWNER.");
    }

    if (lowerText === "/setinfo" || tempState[senderId]) {
        if (lowerText === "/setinfo") {
            const mode = userData ? "UPDATING PROFILE" : "REGISTRATION";
            tempState[senderId] = { step: 1, data: { role: userData ? userData.role : "member" } };
            return sendMessage(senderId, `📝 ${mode}: STEP 1/2\n────────────────────\nPlease enter your username (2-20 characters):`);
        }
        const state = tempState[senderId];
        if (state.step === 1) {
            if (!text || text.length < 2 || text.length > 20) return sendMessage(senderId, "⚠️ INVALID USERNAME\n────────────────────\nName must be 2-20 characters. Try again:");
            const existing = await User.findOne({ name: text });
            if (existing && existing.psid !== senderId) return sendMessage(senderId, "❌ NAME TAKEN\n────────────────────\nThis username is already in use. Please choose another one:");
            state.data.name = text; state.step = 2;
            return sendMessage(senderId, `📝 STEP 2/2\n────────────────────\nPlease enter your age (15-100):`);
        }
        if (state.step === 2) {
            const ageNum = parseInt(text);
            if (isNaN(ageNum) || ageNum < 15 || ageNum > 100) return sendMessage(senderId, "❌ ERROR\n────────────────────\nAge must be a number between 15-100:");
            state.data.age = ageNum;
            await User.findOneAndUpdate({ psid: senderId }, state.data, { upsert: true });
            delete tempState[senderId];
            return sendMessage(senderId, `✅ PROFILE SAVED\n────────────────────\nWelcome ${state.data.name}!\n\nType 'chat' to start.`);
        }
        return;
    }

    if (!userData) return;

    if (lowerText === "/profile") {
        return sendMessage(senderId, `👤 PROFILE INFO\n────────────────────\nName: ${userData.name}\nAge: ${userData.age}\nBadge: ${userData.role.toUpperCase()}`);
    }

    if (lowerText.startsWith("/admin ")) {
        if (userData.role !== "owner") return sendMessage(senderId, "❌ PERMISSION DENIED");
        const parts = text.split(" ");
        const subCommand = parts[1];
        const targetName = parts.slice(2).join(" "); 
        const targetUser = await User.findOne({ name: targetName });
        if (!targetUser) return sendMessage(senderId, "❌ USER NOT FOUND");
        if (subCommand === "add") {
            targetUser.role = "admin";
            await targetUser.save();
            return sendMessage(senderId, `✅ SUCCESS: ${targetName} is now an ADMIN.`);
        } else if (subCommand === "remove") {
            targetUser.role = "member";
            await targetUser.save();
            return sendMessage(senderId, `✅ SUCCESS: ${targetName} demoted to MEMBER.`);
        }
    }

    if (lowerText.startsWith("/ban ")) {
        if (userData.role !== "owner" && userData.role !== "admin") return sendMessage(senderId, "❌ PERMISSION DENIED");
        const targetName = text.split(" ").slice(1).join(" ");
        const targetUser = await User.findOne({ name: targetName });
        if (!targetUser) return sendMessage(senderId, "❌ USER NOT FOUND");
        if (targetUser.role === "owner" || (targetUser.role === "admin" && userData.role !== "owner")) return sendMessage(senderId, "❌ PROTECTION ERROR");
        targetUser.isBanned = true;
        await targetUser.save();
        if (activeChats[targetUser.psid]) {
            const partner = activeChats[targetUser.psid];
            delete activeChats[targetUser.psid]; delete activeChats[partner];
            await sendMessage(partner, "⚠️ SYSTEM\n────────────────────\nYour partner was banned from the bot.");
        }
        return sendMessage(senderId, `🚫 BANNED: ${targetName}`);
    }

    if (lowerText.startsWith("/unban ")) {
        if (userData.role !== "owner" && userData.role !== "admin") return sendMessage(senderId, "❌ PERMISSION DENIED");
        const targetName = text.split(" ").slice(1).join(" ");
        const targetUser = await User.findOne({ name: targetName });
        if (targetUser) {
            targetUser.isBanned = false;
            await targetUser.save();
            return sendMessage(senderId, `🔓 UNBANNED: ${targetName}`);
        }
    }

    if (lowerText === "chat") {
        if (activeChats[senderId]) return sendMessage(senderId, "⚠️ ALERT\nYou are already in a chat.");
        if (waitingQueue.includes(senderId)) return sendMessage(senderId, "🔍 SEARCHING...\nSearching for a partner...");
        const partner = waitingQueue.shift();
        if (partner) {
            activeChats[senderId] = partner; activeChats[partner] = senderId;
            userMessageCount[senderId] = 0; userMessageCount[partner] = 0;
            const pData = await User.findOne({ psid: partner });
            const myData = await User.findOne({ psid: senderId });

            const guide = `\n────────────────────\n💬 GUIDE:\n- Can send images, voice messages, and video\n- Type 'quit' to end chat\n- Be respectful!`;
            
            await sendMessage(senderId, `🎉 CONNECTED!\n────────────────────\nPartner: ${pData.name}\nAge: ${pData.age}\nBadge: ${pData.role.toUpperCase()}${guide}`);
            await sendMessage(partner, `🎉 CONNECTED!\n────────────────────\nPartner: ${myData.name}\nAge: ${myData.age}\nBadge: ${myData.role.toUpperCase()}${guide}`);
        } else {
            waitingQueue.push(senderId);
            await sendMessage(senderId, "🔍 SEARCHING...\n────────────────────\nLooking for a partner. Please wait...");
        }
    }
}

async function handleQuit(id) {
    const partner = activeChats[id];
    if (!partner) return sendMessage(id, "❌ ERROR\nYou are not in a chat.");
    if ((userMessageCount[id] || 0) < 2) return sendMessage(id, "⚠️ RESTRICTION\n────────────────────\nSend at least 2 messages before quitting.");
    delete activeChats[id]; delete activeChats[partner];
    await sendMessage(id, "👋 ENDED\n────────────────────\nYou ended the chat.");
    await sendMessage(partner, "👋 DISCONNECTED\n────────────────────\nStranger has left the conversation.");
}

async function sendMessage(id, text) {
    try { await axios.post(`https://graph.facebook.com/v18.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, { recipient: { id }, message: { text } }); } catch (e) {}
}

async function sendAttachment(id, type, url) {
    try { await axios.post(`https://graph.facebook.com/v18.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, { recipient: { id }, message: { attachment: { type, payload: { url } } } }); } catch (e) {}
}

async function markSeen(id) {
    try { await axios.post(`https://graph.facebook.com/v18.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, { recipient: { id }, sender_action: "mark_seen" }); } catch (e) {}
}

app.listen(PORT, () => console.log(`🚀 Bot Active on ${PORT}`));
