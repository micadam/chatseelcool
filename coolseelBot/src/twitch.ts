import axios from "axios";
import { assert } from "console";
import tmi from "tmi.js";
import {
  Message,
  PrismaClient,
  Segment,
  Stream,
  Streamer,
} from "@prisma/client";

const prisma = new PrismaClient();
const NO_GAME = "OFFLINE";

// TODO migrate to smth cleaner

export class Twitch {
  client_id: string;
  client_secret: string;

  appToken: string;
  tmiClient!: tmi.Client;
  streamer!: Streamer;
  currentStream!: Stream;
  currentSegment!: Segment;
  refreshGameInterval: NodeJS.Timeout | null = null;
  matchVodsInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.client_id = process.env.TWITCH_CLIENT_ID!;
    this.client_secret = process.env.TWITCH_CLIENT_SECRET!;

    this.appToken = "";
    this.handleMessage = this.handleMessage.bind(this);

    this.setUp().then(() => {
      // Refresh game every 10 seconds.
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

  async setUp() {
    await this.refreshToken();
    const streamer = process.env.STREAMER?.toLowerCase() || "coolseel";
    this.streamer = await prisma.streamer.upsert({
      where: { name: streamer },
      create: { name: streamer },
      update: {},
    });
    await this.refreshGame();
    await this.tryToMatchVods();
    await this.setUpTMI();
    this.refreshGameInterval = setInterval(() => this.refreshGame(), 10000);
    this.matchVodsInterval = setInterval(() => this.tryToMatchVods(), 60000);
  }

  destroy() {
    this.initSegment();
    // this.saveChatLog();
    this.tmiClient.disconnect();
    if (this.refreshGameInterval) {
      clearInterval(this.refreshGameInterval);
      this.refreshGameInterval = null;
    }
    if (this.matchVodsInterval) {
      clearInterval(this.matchVodsInterval);
      this.matchVodsInterval = null;
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
      }
    );
    this.appToken = response.data.access_token;
  }

  private async setUpTMI() {
    const tmiClient = new tmi.Client({
      channels: [this.streamer.name],
    });

    tmiClient.on("message", this.handleMessage);
    tmiClient.connect();
    this.tmiClient = tmiClient;
  }

  async handleMessage(
    channel: string,
    tags: tmi.ChatUserstate,
    text: string,
    self: boolean
  ) {
    assert(channel === `#${this.streamer.name}`); // Running for only a single streamer now, so channel is always the same
    assert(!self); // We don't want the bot to ever send a message
    const date = new Date();
    const msg: Message = await prisma.message.create({
      data: {
        segment: {
          connect: { id: this.currentSegment.id },
        },
        username: tags.username || "[UNKNOWN]",
        text,
        secondsSinceStart:
          (date.getTime() - this.currentStream.start.getTime()) / 1000,
      },
    });
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
      { user_login: this.streamer.name }
    );
    if (response.data.data.length === 0) {
      return [NO_GAME, null, null];
    }
    const stream = response.data.data[0];
    return [stream.game_name, stream.id, stream.started_at];
  }

  async initSegment(game?: string) {
    // if the final segment of the current stream in the DB matches the game, don't create a new one
    const lastSegment = await prisma.segment.findFirst({
      where: { streamId: this.currentStream.id },
      orderBy: { start: "desc" },
    });
    console.log(`lastSegment: ${lastSegment}`);
    if (lastSegment && lastSegment?.game === game) {
      this.currentSegment = lastSegment;
      return;
    }
    this.currentSegment = await prisma.segment.create({
      data: {
        start: new Date(),
        stream: { connect: { id: this.currentStream.id } },
        game: game ?? NO_GAME,
      },
    });
  }

  async refreshGame() {
    let [newGame, streamId, startedAt] = await this.getStreamInfo();
    const currentGame = this.currentSegment?.game;
    if (currentGame === newGame) {
      return;
    }
    console.log(`Game changed from ${currentGame} to ${newGame}`);
    if (newGame === NO_GAME) {
      // find the most recent stream (or 0), and set the current twitch ID to
      // the twitch ID of that stream plus "_post"
      const lastStream = await prisma.stream.findFirst({
        where: { streamerId: this.streamer.id },
        orderBy: { start: "desc" },
      });
      streamId = `${lastStream?.twitchId ?? "PRESTREAM"}_post`;
      startedAt = new Date();
    }
    this.currentStream = await prisma.stream.upsert({
      where: { twitchId: streamId },
      create: {
        streamer: {
          connect: { id: this.streamer.id },
        },
        live: newGame !== NO_GAME,
        twitchId: streamId,
        start: startedAt,
      },
      update: {},
    });
    await this.initSegment(newGame);
    console.log("Here are the stream and segment:");
    console.log(this.currentStream);
    console.log(this.currentSegment);
    return;
  }

  async getUserId(username: string) {
    const response = await this.reauthGet(
      "https://api.twitch.tv/helix/users",
      { login: username }
    );
    if (response.data.data.length === 0) {
      return null;
    }
    return response.data.data[0].id;
  }

  async getVodId(stream: Stream & { streamer: Streamer }) {
    const userId = await this.getUserId(stream.streamer.name);
    if (!userId) {
      return null;
    }
    const response = await this.reauthGet(
      "https://api.twitch.tv/helix/videos",
      { user_id: userId, type: "archive" }
    );
    if (response.data.data.length === 0) {
      return null;
    }
    const matching = response.data.data.filter((vod: {stream_id: string}) => vod.stream_id === stream.twitchId)
    if (matching.length === 0) {
      return null;
    }
    return matching[0].id;
  }

  async tryToMatchVods() {
    const streamsWithoutVods = await prisma.stream.findMany({
      where: { vodId: null, live: true },
      include: { streamer: true },
    });
    console.log(`Attempting to match ${streamsWithoutVods.length} streams without vods`)
    let count = 0;
    for (const stream of streamsWithoutVods) {
      const vodId = await this.getVodId(stream);
      if (vodId) {
        await prisma.stream.update({
          where: { id: stream.id },
          data: { vodId },
        });
        count++;
      }
    }
    console.log(`Matched ${count}/${streamsWithoutVods.length} vods`)
  }

}
