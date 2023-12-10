import axios from "axios";
import { assert } from "console";
import tmi from "tmi.js";
import * as fs from "fs";

// TODO migrate to smth cleaner
const client_id = process.env.TWITCH_CLIENT_ID;
const client_secret = process.env.TWITCH_CLIENT_SECRET;
const STREAMER = process.env.STREAMER?.toLowerCase() || "coolseel";
const SAVE_CHAT_LOG_INTERVAL = parseInt(process.env.SAVE_CHAT_LOG_INTERVAL || (1000 * 60 * 60).toString(), 10);

interface Message {
    username: string;
    message: string;
    timestamp: Date;
    currentGame?: string;
}

export class Twitch {
    appToken: string;
    expiresAt: Date;
    tmiClient: tmi.Client = new tmi.Client({channels: [STREAMER]});
    currentGame: string = "NONE";
    messages: Message[] = [];
    refreshGameInterval: NodeJS.Timeout | null = null;
    saveChatLogInterval: NodeJS.Timeout | null = null;

    constructor() {
        this.appToken = "";
        this.expiresAt = new Date();
        this.handleMessage = this.handleMessage.bind(this);

        this.refreshToken().then(() => {
            this.refreshGame();
            // Refresh game every 10 seconds.
            this.refreshGameInterval = setInterval(() => this.refreshGame(), 10000);
            this.setUpTMI();
        });
        // Save chat log every 1 hour.
        this.saveChatLogInterval = setInterval(() => this.saveChatLog(), SAVE_CHAT_LOG_INTERVAL);
    }

    private async refreshToken() {
        const response = await axios.post(
            "https://id.twitch.tv/oauth2/token",
            null,
            {
                params: {
                    client_id,
                    client_secret,
                    grant_type: "client_credentials",
                },
            },
        );
        this.appToken = response.data.access_token;
        this.expiresAt = new Date(Date.now() + response.data.expires_in * 1000);
    }

    private async setUpTMI() {
        const tmiClient = new tmi.Client({
            channels: [STREAMER],
        });

        tmiClient.on("message", this.handleMessage)
        tmiClient.connect();
        this.tmiClient = tmiClient;
    }

    private async handleMessage(channel: string, tags: tmi.ChatUserstate, message: string, self: boolean) {
        assert(channel === `#${STREAMER}`); // Running for only a single streamer now, so channel is always the same
        assert(!self); // We don't want the bot to ever send a message
        const msg: Message = {
            username: tags.username!,
            message,
            timestamp: new Date(),
            currentGame: this.currentGame,
        };
        this.messages.push(msg);
        console.log(msg);

    }

    private async get(url: string, params: any) {
        return axios.get(url, {
            params,
            headers: {
                "Client-ID": client_id,
                "Authorization": `Bearer ${this.appToken}`,
            },
        });
    }

    private async reauthGet(url: string, params: any) {
        const response = await this.get(url, params);
        if (response.status === 401) {
            await this.refreshToken();
            return this.get(url, params);
        }
        return response;
    }


    private async refreshGame() {
        const response = await this.reauthGet(
            "https://api.twitch.tv/helix/streams",
            { user_login: STREAMER },
        )
        if (response.data.data.length === 0) {
            this.currentGame = "NONE";
            return;
        }
        const stream = response.data.data[0];
        const game_id = stream.game_id;
        const response2 = await this.reauthGet(
            "https://api.twitch.tv/helix/games",
            { id: game_id },
        )
        const newGame = response2.data.data[0].name;
        if (this.currentGame !== newGame) {
            console.log(`Game changed from ${this.currentGame} to ${newGame}`);
            this.currentGame = response2.data.data[0].name;
        }
    }

    private async saveChatLog() {
        if (this.messages.length === 0) {
            return;
        }
        // Save the chat log to a file under ./data/${STREAMER}/${timesamp}.json
        const timestamp = new Date().toISOString();
        // How to handle race conditions?
        const data = JSON.stringify(this.messages, null, 2);
        this.messages = [];
        if (!fs.existsSync(`./data/${STREAMER}`)) {
            fs.mkdirSync(`./data/${STREAMER}`, { recursive: true });
        }
        fs.writeFileSync(`./data/${STREAMER}/${timestamp}.json`, data);
    }
}