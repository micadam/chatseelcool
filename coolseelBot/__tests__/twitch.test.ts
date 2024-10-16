import axios from "axios";
import tmi from "tmi.js";
import fs from "fs";

import { Twitch } from "../src/twitch";

jest.mock("tmi.js", () => ({
  Client: jest.fn().mockImplementation(),
}));
const mockTmi = tmi as jest.Mocked<typeof tmi>;
jest.mock("fs");
const mockFs = fs as jest.Mocked<typeof fs>;
jest.mock("axios");
const mockAxios = axios as jest.Mocked<typeof axios>;

describe("Twitch", () => {
  let twitch: Twitch;
  const realDate = Date;
  const realSetInterval = setInterval;
  const realClearInterval = clearInterval;
  const realProcess = process;

  beforeEach(() => {
    mockTmi.Client.mockImplementation(
      () =>
        ({
          on: jest.fn(),
          connect: jest.fn(),
          disconnect: jest.fn(),
        }) as any,
    );
    mockAxios.post.mockImplementation(
      () =>
        ({
          data: {
            access_token: "TEST_TOKEN",
          },
        }) as any,
    );
    mockAxios.get.mockImplementation(
      () =>
        ({
          status: 200,
          data: {
            data: [
              {
                game_name: "TEST_GAME_NAME",
                id: "TEST_STREAM_ID",
                started_at: new Date().toISOString(),
              },
            ],
          },
        }) as any,
    );

    // Set up globals
    global.Date = jest.fn(
      () => new realDate("2021-01-01T00:00:00.000Z"),
    ) as any;
    global.setInterval = jest.fn(() => 1) as any;
    global.clearInterval = jest.fn(() => 1) as any;
    global.process = {
      on: realProcess.on.bind(realProcess),
      exit: jest.fn(),
      env: {
        TWITCH_CLIENT_ID: "TEST_CLIENT",
        TWITCH_CLIENT_SECRET: "TEST_SECRET",
        STREAMER: "TEST_STREAMER",
      },
    } as any;

    // Create the twitch object
    twitch = new Twitch();
  });

  afterEach(() => {
    twitch.destroy();
    jest.resetAllMocks();
    realProcess.removeAllListeners("SIGINT");
    realProcess.removeAllListeners("SIGTERM");
    global.Date = realDate;
    global.setInterval = realSetInterval;
    global.clearInterval = realClearInterval;
    global.process = realProcess;
  });

  it("should initialize successfully", () => {
    expect(twitch.client_id).toBe("TEST_CLIENT");
    expect(twitch.client_secret).toBe("TEST_SECRET");
    expect(twitch.streamer).toBe("test_streamer");
    expect(twitch.appToken).toBe("TEST_TOKEN");
    expect(twitch.currentStream).toStrictEqual({
      id: "TEST_STREAM_ID",
      live: true,
      start: new Date(),
      segments: [],
    });
    expect(twitch.currentSegment).toStrictEqual({
      start: new Date(),
      game: "TEST_GAME_NAME",
      messages: [],
    });
    expect(twitch.refreshGameInterval).toStrictEqual(1);
    // fs never called during init
    expect(mockFs.writeFileSync).not.toHaveBeenCalled();
    // tmi calls
    expect(mockTmi.Client).toHaveBeenCalledTimes(1);
    expect(mockTmi.Client).toHaveBeenCalledWith({
      channels: ["test_streamer"],
    });
    expect(twitch.tmiClient.on).toHaveBeenCalledTimes(1);
    expect(twitch.tmiClient.on).toHaveBeenCalledWith(
      "message",
      twitch.handleMessage,
    );
    expect(twitch.tmiClient.connect).toHaveBeenCalledTimes(1);
    // axios calls
    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(axios.post).toHaveBeenCalledWith(
      "https://id.twitch.tv/oauth2/token",
      null,
      {
        params: {
          client_id: "TEST_CLIENT",
          client_secret: "TEST_SECRET",
          grant_type: "client_credentials",
        },
      },
    );
    expect(axios.get).toHaveBeenCalledTimes(1);
    expect(axios.get).toHaveBeenNthCalledWith(
      1,
      "https://api.twitch.tv/helix/streams",
      {
        params: {
          user_login: "test_streamer",
        },
        headers: {
          "Client-ID": "TEST_CLIENT",
          Authorization: "Bearer TEST_TOKEN",
        },
      },
    );
  });

  it("should destroy successfully", () => {
    twitch.destroy();
    expect(twitch.refreshGameInterval).toBeNull();
  });

  it("should refresh token successfully", async () => {
    const tokens = ["TEST_TOKEN_1", "TEST_TOKEN_2"];
    for (const token of tokens) {
      mockAxios.post.mockImplementationOnce(
        () =>
          ({
            data: {
              access_token: token,
            },
          }) as any,
      );
      await twitch.refreshToken();
      expect(twitch.appToken).toBe(token);
    }
    expect(axios.post).toHaveBeenCalledTimes(tokens.length + 1); // +1 for the initial call
  });

  it("should handle a single message", () => {
    twitch.handleMessage(
      "#test_streamer",
      { username: "test_user" },
      "test_text",
      false,
    );
    expect(twitch.currentStream).toStrictEqual({
      id: "TEST_STREAM_ID",
      live: true,
      start: new Date(),
      segments: [],
    });
    expect(twitch.currentSegment).toStrictEqual({
      start: new Date(),
      game: "TEST_GAME_NAME",
      messages: [
        {
          username: "test_user",
          text: "test_text",
          secondsSinceStart: 0,
        },
      ],
    });
  });

  it("Saves the correct data to file", async () => {
    mockAxios.get.mockImplementationOnce(
      () =>
        ({
          status: 200,
          data: {
            data: [],
          },
        }) as any,
    );
    await twitch.refreshGame();
    expect(mockFs.writeFileSync).toHaveBeenCalledTimes(1);
    expect(mockFs.writeFileSync).toHaveBeenNthCalledWith(
      1,
      "./data/test_streamer/2021-01-01T00:00:00.000Z_live.json",
      JSON.stringify(
        {
          id: "TEST_STREAM_ID",
          live: true,
          start: new Date(),
          segments: [
            {
              start: new Date(),
              game: "TEST_GAME_NAME",
              messages: [],
            },
          ],
        },
        null,
        2,
      ),
    );
    expect(twitch.currentStream).toStrictEqual({
      live: false,
      start: new Date(),
      segments: [],
    });
    expect(twitch.currentSegment).toStrictEqual({
      start: new Date(),
      game: "OFFLINE",
      messages: [],
    });
    // First send two offline messages
    for (const message of ["test_message_1", "test_message_2"]) {
      twitch.handleMessage(
        "#test_streamer",
        { username: "test_user" },
        message,
        false,
      );
    }
    // Switch the game to online
    mockAxios.get.mockImplementation(
      () =>
        ({
          status: 200,
          data: {
            data: [
              {
                id: "TEST_STREAM_ID",
                game_name: "TEST_GAME_NAME_2",
                started_at: new Date().toISOString(),
              },
            ],
          },
        }) as any,
    );
    await twitch.refreshGame();
    expect(mockFs.writeFileSync).toHaveBeenCalledTimes(2);
    expect(mockFs.writeFileSync).toHaveBeenNthCalledWith(
      2,
      "./data/test_streamer/2021-01-01T00:00:00.000Z_off.json",
      JSON.stringify(
        {
          live: false,
          start: new Date(),
          segments: [
            {
              start: new Date(),
              game: "OFFLINE",
              messages: [
                {
                  username: "test_user",
                  text: "test_message_1",
                  secondsSinceStart: 0,
                },
                {
                  username: "test_user",
                  text: "test_message_2",
                  secondsSinceStart: 0,
                },
              ],
            },
          ],
        },
        null,
        2,
      ),
    );
    expect(twitch.currentStream).toStrictEqual({
      id: "TEST_STREAM_ID",
      live: true,
      start: new Date(),
      segments: [],
    });
    expect(twitch.currentSegment).toStrictEqual({
      start: new Date(),
      game: "TEST_GAME_NAME_2",
      messages: [],
    });
    for (const message of [
      "live_message_1",
      "live_message_2",
      "live_message_3",
    ]) {
      twitch.handleMessage(
        "#test_streamer",
        { username: "test_user" },
        message,
        false,
      );
    }
    mockAxios.get.mockImplementationOnce(
      () =>
        ({
          status: 200,
          data: {
            data: [],
          },
        }) as any,
    );
    await twitch.refreshGame();
    expect(mockFs.writeFileSync).toHaveBeenCalledTimes(3);
    expect(mockFs.writeFileSync).toHaveBeenNthCalledWith(
      3,
      "./data/test_streamer/2021-01-01T00:00:00.000Z_live.json",
      JSON.stringify(
        {
          id: "TEST_STREAM_ID",
          live: true,
          start: new Date(),
          segments: [
            {
              start: new Date(),
              game: "TEST_GAME_NAME_2",
              messages: [
                {
                  username: "test_user",
                  text: "live_message_1",
                  secondsSinceStart: 0,
                },
                {
                  username: "test_user",
                  text: "live_message_2",
                  secondsSinceStart: 0,
                },
                {
                  username: "test_user",
                  text: "live_message_3",
                  secondsSinceStart: 0,
                },
              ],
            },
          ],
        },
        null,
        2,
      ),
    );

    expect(twitch.currentStream).toStrictEqual({
      live: false,
      start: new Date(),
      segments: [],
    });
    expect(twitch.currentSegment).toStrictEqual({
      start: new Date(),
      game: "OFFLINE",
      messages: [],
    });
  });

  it("should handle a multi-segment stream", async () => {
    for (const message of [
      "game1_message_1",
      "game1_message_2",
      "game1_message_3",
    ]) {
      twitch.handleMessage(
        "#test_streamer",
        { username: "test_user" },
        message,
        false,
      );
    }
    expect(twitch.currentStream).toStrictEqual({
      id: "TEST_STREAM_ID",
      live: true,
      start: new Date(),
      segments: [],
    });
    expect(twitch.currentSegment).toStrictEqual({
      start: new Date(),
      game: "TEST_GAME_NAME",
      messages: [
        {
          username: "test_user",
          text: "game1_message_1",
          secondsSinceStart: 0,
        },
        {
          username: "test_user",
          text: "game1_message_2",
          secondsSinceStart: 0,
        },
        {
          username: "test_user",
          text: "game1_message_3",
          secondsSinceStart: 0,
        },
      ],
    });
    mockAxios.get.mockImplementation(
      () =>
        ({
          status: 200,
          data: {
            data: [
              {
                id: "TEST_STREAM_ID",
                game_name: "TEST_GAME_NAME_2",
                started_at: new Date().toISOString(),
              },
            ],
          },
        }) as any,
    );
    await twitch.refreshGame();
    expect(twitch.currentStream).toStrictEqual({
      id: "TEST_STREAM_ID",
      live: true,
      start: new Date(),
      segments: [
        {
          start: new Date(),
          game: "TEST_GAME_NAME",
          messages: [
            {
              username: "test_user",
              text: "game1_message_1",
              secondsSinceStart: 0,
            },
            {
              username: "test_user",
              text: "game1_message_2",
              secondsSinceStart: 0,
            },
            {
              username: "test_user",
              text: "game1_message_3",
              secondsSinceStart: 0,
            },
          ],
        },
      ],
    });
    expect(twitch.currentSegment).toStrictEqual({
      start: new Date(),
      game: "TEST_GAME_NAME_2",
      messages: [],
    });
    mockAxios.get.mockImplementation(
      () =>
        ({
          status: 200,
          data: {
            data: [
              {
                id: "TEST_STREAM_ID",
                game_name: "TEST_GAME_NAME_3",
                started_at: new Date().toISOString(),
              },
            ],
          },
        }) as any,
    );
    await twitch.refreshGame();
    for (const message of [
      "game3_message_1",
      "game3_message_2",
      "game3_message_3",
    ]) {
      twitch.handleMessage(
        "#test_streamer",
        { username: "test_user" },
        message,
        false,
      );
    }
    expect(twitch.currentStream).toStrictEqual({
      id: "TEST_STREAM_ID",
      live: true,
      start: new Date(),
      segments: [
        {
          start: new Date(),
          game: "TEST_GAME_NAME",
          messages: [
            {
              username: "test_user",
              text: "game1_message_1",
              secondsSinceStart: 0,
            },
            {
              username: "test_user",
              text: "game1_message_2",
              secondsSinceStart: 0,
            },
            {
              username: "test_user",
              text: "game1_message_3",
              secondsSinceStart: 0,
            },
          ],
        },
        {
          start: new Date(),
          game: "TEST_GAME_NAME_2",
          messages: [],
        },
      ],
    });
    expect(twitch.currentSegment).toStrictEqual({
      start: new Date(),
      game: "TEST_GAME_NAME_3",
      messages: [
        {
          username: "test_user",
          text: "game3_message_1",
          secondsSinceStart: 0,
        },
        {
          username: "test_user",
          text: "game3_message_2",
          secondsSinceStart: 0,
        },
        {
          username: "test_user",
          text: "game3_message_3",
          secondsSinceStart: 0,
        },
      ],
    });
    mockAxios.get.mockImplementation(
      () =>
        ({
          status: 200,
          data: {
            data: [],
          },
        }) as any,
    );
    await twitch.refreshGame();
    expect(mockFs.writeFileSync).toHaveBeenCalledTimes(1);
    expect(mockFs.writeFileSync).toHaveBeenNthCalledWith(
      1,
      "./data/test_streamer/2021-01-01T00:00:00.000Z_live.json",
      JSON.stringify(
        {
          id: "TEST_STREAM_ID",
          live: true,
          start: new Date(),
          segments: [
            {
              start: new Date(),
              game: "TEST_GAME_NAME",
              messages: [
                {
                  username: "test_user",
                  text: "game1_message_1",
                  secondsSinceStart: 0,
                },
                {
                  username: "test_user",
                  text: "game1_message_2",
                  secondsSinceStart: 0,
                },
                {
                  username: "test_user",
                  text: "game1_message_3",
                  secondsSinceStart: 0,
                },
              ],
            },
            {
              start: new Date(),
              game: "TEST_GAME_NAME_2",
              messages: [],
            },
            {
              start: new Date(),
              game: "TEST_GAME_NAME_3",
              messages: [
                {
                  username: "test_user",
                  text: "game3_message_1",
                  secondsSinceStart: 0,
                },
                {
                  username: "test_user",
                  text: "game3_message_2",
                  secondsSinceStart: 0,
                },
                {
                  username: "test_user",
                  text: "game3_message_3",
                  secondsSinceStart: 0,
                },
              ],
            },
          ],
        },
        null,
        2,
      ),
    );
    expect(twitch.currentStream).toStrictEqual({
      live: false,
      start: new Date(),
      segments: [],
    });
    expect(twitch.currentSegment).toStrictEqual({
      start: new Date(),
      game: "OFFLINE",
      messages: [],
    });
  });

  it("should handle 401 with reauth", async () => {
    mockAxios.get.mockReset();
    mockAxios.get.mockImplementationOnce(
      () =>
        ({
          status: 401,
        }) as any,
    );
    mockAxios.get.mockImplementationOnce(
      () =>
        ({
          status: 200,
          data: {
            data: [],
          },
        }) as any,
    );
    await twitch.refreshGame();
    expect(mockAxios.post).toHaveBeenCalledTimes(2); // 1 + 1 for init
    expect(mockAxios.get).toHaveBeenCalledTimes(2);
    expect(mockAxios.get).toHaveBeenNthCalledWith(
      1,
      "https://api.twitch.tv/helix/streams",
      {
        params: {
          user_login: "test_streamer",
        },
        headers: {
          "Client-ID": "TEST_CLIENT",
          Authorization: "Bearer TEST_TOKEN",
        },
      },
    );
    expect(mockAxios.get).toHaveBeenNthCalledWith(
      2,
      "https://api.twitch.tv/helix/streams",
      {
        params: {
          user_login: "test_streamer",
        },
        headers: {
          "Client-ID": "TEST_CLIENT",
          Authorization: "Bearer TEST_TOKEN",
        },
      },
    );
  });

  it.each(["SIGINT", "SIGTERM"])(`should handle signal %s`, async (signal) => {
    for (const message of ["message", "msg2"]) {
      twitch.handleMessage(
        "#test_streamer",
        { username: "test_user" },
        message,
        false,
      );
    }
    realProcess.emit(signal as any);
    expect(mockFs.writeFileSync).toHaveBeenCalledTimes(1);
    expect(mockFs.writeFileSync).toHaveBeenNthCalledWith(
      1,
      "./data/test_streamer/2021-01-01T00:00:00.000Z_live.json",
      JSON.stringify(
        {
          id: "TEST_STREAM_ID",
          live: true,
          start: new Date(),
          segments: [
            {
              start: new Date(),
              game: "TEST_GAME_NAME",
              messages: [
                {
                  username: "test_user",
                  text: "message",
                  secondsSinceStart: 0,
                },
                {
                  username: "test_user",
                  text: "msg2",
                  secondsSinceStart: 0,
                },
              ],
            },
          ],
        },
        null,
        2,
      ),
    );
  });
});
