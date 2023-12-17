import fs from 'fs';

import {
	Category,
	type Stream,
	type StreamStats,
	type StreamerWithMessages,
	type CategoryStats
} from '$lib/stream';

abstract class DataProvider {
	abstract getStreamers(): String[];
	abstract getDataForStreamer(streamer: String): Stream[];
	abstract getStreamStats(streamer: String, streamId: String): StreamStats;
}

const CLIP_DURATION = 20;
const CLIP_OFFSET = 5;

const KEYWORDS_PER_CATEGORY = new Map<Category, string[]>([
	[Category.ALL, ['']],
	[Category.POG, ['pog', 'poggers', 'pogchamp', 'letsgo', 'pogcrazy']],
	[Category.LAUGH, ['lul', 'icant']],
	[Category.SCARY, ['monkas']],
	[Category.HORNY, ['cocka']],
	[Category.GOOD_BIT, ['+2']],
	[Category.BAD_BIT, ['-2']]
]);

export class JSONDataProvider extends DataProvider {
	private readonly data: StreamerWithMessages[];

	constructor(fileDir: string) {
		super();
		this.data = [
			...fs.readdirSync(fileDir).map((streamer) => {
				const streamerDir = `${fileDir}/${streamer}`;
				return {
					name: streamer,
					streams: fs
						.readdirSync(streamerDir)
						.map((fileName) => {
							const file = fs.readFileSync(`${streamerDir}/${fileName}`, { encoding: 'utf-8' });
							return JSON.parse(file);
						})
						.filter((stream) => stream.live)
						.sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime())
				};
			})
		];
	}

	getStreamers(): String[] {
		return this.data.map((streamer) => streamer.name);
	}

	getDataForStreamer(streamer: String): Stream[] {
		const streams = this.data.find((s) => s.name === streamer)?.streams ?? [];
		// return streams without messages
		return streams.map((stream) => ({
			id: stream.id,
			start: stream.start,
			segments: stream.segments.map((segment) => ({
				start: segment.start,
				game: segment.game
			})),
			live: stream.live
		}));
	}

	getStreamStats(streamer: String, streamId: String): StreamStats {
		const stream = this.data
			.find((s) => s.name === streamer)
			?.streams.find((s) => s.id === streamId);
		if (stream === undefined) {
			return {
				categoryStats: new Map<Category, CategoryStats>()
			};
		}
		const messages = stream.segments.map((segment) => segment.messages).flat();
		const categoryStats = new Map<Category, CategoryStats>();
		KEYWORDS_PER_CATEGORY.forEach((keywords, category) => {
			const messagesWithKeywords = messages
				.filter((message) =>
					keywords.some(
						(keyword) =>
							keyword == '' || message.text.toLowerCase().split(/(\s+)/).includes(keyword)
					)
				)
				.map((message) => Math.trunc(message.secondsSinceStart / CLIP_DURATION));
			if (messagesWithKeywords.length === 0) {
				categoryStats.set(category, {
					topClips: [],
					messagesPerPeriod: []
				});
				return;
			}
			const messagesPerPeriod = new Map<number, number>();
			messagesWithKeywords.forEach((seconds) =>
				messagesPerPeriod.set(seconds, (messagesPerPeriod.get(seconds) ?? 0) + 1)
			);

			const topClips = [...messagesPerPeriod.entries()]
				.sort((a, b) => b[1] - a[1])
				.slice(0, 20)
				.map((entry) => ({
					secondsSinceStart: entry[0] * CLIP_DURATION - CLIP_OFFSET,
					numMessages: entry[1]
				}))
				.filter((clip) => clip.numMessages >= CLIP_DURATION); // require at least one message per second
			const maxPeriod = Math.max(...messagesPerPeriod.keys());
			const messagesPerPeriodArray = new Array(maxPeriod + 1).fill(0);
			messagesPerPeriod.forEach((value, key) => {
				messagesPerPeriodArray[key] = value;
			});
			categoryStats.set(category, {
				topClips,
				messagesPerPeriod: messagesPerPeriodArray
			});
		});
		return {
			categoryStats
		};
	}
}

export const INSTANCE: DataProvider = new JSONDataProvider(
	'/home/adam/coolseelBot/coolseelBot/data'
);
