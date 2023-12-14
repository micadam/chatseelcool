import axios from "axios";
import { assert } from "console";
import tmi from "tmi.js";
import * as fs from "fs";

const NO_GAME = "OFFLINE";

// TODO migrate to smth cleaner

interface Message {
    username: string;
    text: string;
    secondsSinceStart: number;
}

interface StreamSegment {
    start: Date,
    game: string,
    messages: Message[],
}

interface Stream {
    start: Date,
    segments: StreamSegment[],
    live: boolean,
}

export class Twitch {
    client_id: string;
    client_secret: string;
    streamer: string;

    appToken: string;
    tmiClient!: tmi.Client;
    currentStream: Stream = {
        start: new Date(),
        segments: [],
        live: false,
    };
    currentSegment: StreamSegment = {
        start: new Date(),
        game: NO_GAME,
        messages: [],
    };
    refreshGameInterval: NodeJS.Timeout | null = null;

    constructor() {
        this.client_id = process.env.TWITCH_CLIENT_ID!;
        this.client_secret = process.env.TWITCH_CLIENT_SECRET!;
        this.streamer = process.env.STREAMER?.toLowerCase() || "coolseel";
        
        this.appToken = "";
        this.handleMessage = this.handleMessage.bind(this);

        this.refreshToken().then(() => {
            this.refreshGame();
            // Refresh game every 10 seconds.
            this.refreshGameInterval = setInterval(() => this.refreshGame(), 10000);
            this.setUpTMI();
            console.log("Initialized successfully");
        });
    }

    destroy() {
        if (this.refreshGameInterval) {
            clearInterval(this.refreshGameInterval);
            this.refreshGameInterval = null;
        }
    }

    async refreshToken() {
        const response = await axios.post(
            "https://id.twitch.tv/oauth2/token",
            null,
            {
                params: {
                    client_id: this.client_id,
                    client_secret: this.client_secret,
                    grant_type: "client_credentials",
                },
            },
        );
        this.appToken = response.data.access_token;
    }

    private async setUpTMI() {
        const tmiClient = new tmi.Client({
            channels: [this.streamer],
        });

        tmiClient.on("message", this.handleMessage)
        tmiClient.connect();
        this.tmiClient = tmiClient;
    }

    async handleMessage(channel: string, tags: tmi.ChatUserstate, text: string, self: boolean) {
        assert(channel === `#${this.streamer}`); // Running for only a single streamer now, so channel is always the same
        assert(!self); // We don't want the bot to ever send a message
        const date = new Date();
        const msg: Message = {
            username: tags.username || "[UNKNOWN]",
            text,
            secondsSinceStart: (date.getTime() - this.currentSegment.start.getTime()) / 1000,
        };
        this.currentSegment.messages.push(msg);
        console.log(msg);
    }

    private async get(url: string, params: any) {
        return axios.get(url, {
            params,
            headers: {
                "Client-ID": this.client_id,
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

    async getCurrentGame() {
        const response = await this.reauthGet(
            "https://api.twitch.tv/helix/streams",
            { user_login: this.streamer },
        )
        if (response.data.data.length === 0) {
            return NO_GAME;
        }
        const stream = response.data.data[0];
        const game_id = stream.game_id;
        const response2 = await this.reauthGet(
            "https://api.twitch.tv/helix/games",
            { id: game_id },
        )
        return response2.data.data[0].name;
    }


    async refreshGame() {
        const newGame = await this.getCurrentGame();
        const currentGame = this.currentSegment.game;
        if (currentGame === newGame) {
            return;
        }
        console.log(`Game changed from ${currentGame} to ${newGame}`);
        this.currentStream.segments.push(this.currentSegment);
        this.currentSegment = {
            start: new Date(),
            game: newGame,
            messages: [],
        };
        if (currentGame === NO_GAME || newGame === NO_GAME) {
            // Stream just started or ended
            await this.saveChatLog();
            this.currentStream = {
                start: new Date(),
                segments: [],
                live: newGame === NO_GAME ? false : true,
            };
            return;
        }
    }

    private async saveChatLog() {
        // Don't save zero-message off-streams
        if (!this.currentStream.live && this.currentStream.segments[0].messages.length === 0) {
            return;
        }
        const timestamp = new Date().toISOString();
        // NOTE: How to handle race conditions?
        const data = JSON.stringify(this.currentStream, null, 2);
        const name = this.currentStream.live ? "live" : "off";
        this.currentSegment.messages = [];
        if (!fs.existsSync(`./data/${this.streamer}`)) {
            fs.mkdirSync(`./data/${this.streamer}`, { recursive: true });
        }
        fs.writeFileSync(`./data/${this.streamer}/${timestamp}_${name}.json`, data);
    }
}