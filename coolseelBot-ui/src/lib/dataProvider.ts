import fs from 'fs';
import { PrismaClient, type Segment, type Stream, type Streamer } from '@prisma/client';
import { Category, type CategoryStats, type StreamStats } from './stream';

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

export class PrismaDataProvider {
	private readonly client: PrismaClient;
	constructor() {
		this.client = new PrismaClient();
	}
	async getStreamers() {
		return await this.client.streamer.findMany();
	}

	async getDataForStreamer(streamer: Streamer) {
		const data = await this.client.stream.findMany({
			where: {
				streamerId: streamer.id,
				live: true,
			},
			include: {
				segments: true,
			}
		});
		for (const stream of data) {
			console.log(stream.segments);
		}
		return data;
	}

	async getStreamStats(stream: Stream) {
		const messages = await this.client.message.findMany({
			where: {
				segment: {
					stream: {
						id: stream.id,
						live: true,
					}
				}
			}
		});

		const categoryStats = new Map<Category, CategoryStats>();
		for (const [category, keywords] of KEYWORDS_PER_CATEGORY.entries()) {
			const matchingPeriods = messages
				.filter((message) =>
					keywords.some(
						(keyword) => keyword == '' || message.text.toLowerCase().split(/(\s+)/).includes(keyword)
					)
				)
				.map((message) => Math.trunc(message.secondsSinceStart / CLIP_DURATION));
			if (matchingPeriods.length == 0) {
				categoryStats.set(category, {
					topClips: [],
					messagesPerPeriod: []
				});
				continue;
			}
			const counts = matchingPeriods.reduce(
				(counts, period) => counts.set(period, (counts.get(period) ?? 0) + 1),
				new Map<number, number>()
			);
			const topClips = [...counts.entries()]
			.filter(([_, count]) => count >= CLIP_DURATION)
				.sort(([_, count1], [__, count2]) => count2 - count1)
				.slice(0, 20)
				.map(([period, count]) => ({
					secondsSinceStart: period * CLIP_DURATION + CLIP_OFFSET,
					numMessages: count
				}));
			const maxPeriod = Math.max(...counts.keys());
			console.log(maxPeriod);
			const messagesPerPeriod = new Array(maxPeriod + 1).fill(0);
			counts.forEach((period, count) => {
				messagesPerPeriod[period] = count;
			});
			categoryStats.set(category, {
				topClips,
				messagesPerPeriod
			});
		}

		return {
			categoryStats
		};
	}
}

export const INSTANCE = new PrismaDataProvider();
