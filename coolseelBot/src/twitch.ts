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
  start: Date;
  game: string;
  messages: Message[];
}

interface Stream {
  start: Date;
  segments: StreamSegment[];
  live: boolean;
}

interface LiveStream extends Stream {
  id: string;
  live: true;
}

interface OffStream extends Stream {
  live: false;
}

type StreamType = LiveStream | OffStream;

export class Twitch {
  client_id: string;
  client_secret: string;
  streamer: string;

  appToken: string;
  tmiClient!: tmi.Client;
  currentStream: StreamType = {
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
      const handleSignal = () => {
        console.log("Shutting down...");
        this.destroy();
        process.exit(0);
      };
      process.on("SIGINT", handleSignal);
      process.on("SIGTERM", handleSignal);
    });
  }

  destroy() {
    this.closeSegment();
    this.saveChatLog();
    this.tmiClient.disconnect();
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

    tmiClient.on("message", this.handleMessage);
    tmiClient.connect();
    this.tmiClient = tmiClient;
  }

  handleMessage(
    channel: string,
    tags: tmi.ChatUserstate,
    text: string,
    self: boolean,
  ) {
    assert(channel === `#${this.streamer}`); // Running for only a single streamer now, so channel is always the same
    assert(!self); // We don't want the bot to ever send a message
    const date = new Date();
    const msg: Message = {
      username: tags.username || "[UNKNOWN]",
      text,
      secondsSinceStart:
        (date.getTime() - this.currentStream.start.getTime()) / 1000,
    };
    this.currentSegment.messages.push(msg);
    console.log(msg);
  }

  private async get(url: string, params: any) {
    return axios.get(url, {
      params,
      headers: {
        "Client-ID": this.client_id,
        Authorization: `Bearer ${this.appToken}`,
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

  async getStreamInfo() {
    const response = await this.reauthGet(
      "https://api.twitch.tv/helix/streams",
      { user_login: this.streamer },
    );
    if (response.data.data.length === 0) {
      return [NO_GAME, null, null];
    }
    const stream = response.data.data[0];
    return [stream.game_name, stream.id, stream.started_at];
  }

  closeSegment(game?: string) {
    this.currentStream.segments.push(this.currentSegment);
    this.currentSegment = {
      start: new Date(),
      game: game ?? NO_GAME,
      messages: [],
    };
  }

  async refreshGame() {
    const [newGame, streamId, startedAt] = await this.getStreamInfo();
    const currentGame = this.currentSegment.game;
    if (currentGame === newGame) {
      return;
    }
    console.log(`Game changed from ${currentGame} to ${newGame}`);
    this.closeSegment(newGame);
    if (currentGame === NO_GAME || newGame === NO_GAME) {
      // Stream just started or ended
      this.saveChatLog();
      this.currentStream = {
        ...(newGame !== NO_GAME
          ? { id: streamId, live: true }
          : { live: false }),
        start: startedAt ? new Date(startedAt) : new Date(),
        segments: [],
      };
      return;
    }
  }

  private saveChatLog() {
    // Don't save zero-message off-streams
    if (
      !this.currentStream.live &&
      this.currentStream.segments[0].messages.length === 0
    ) {
      return;
    }
    const timestamp = this.currentStream.start.toISOString();
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
