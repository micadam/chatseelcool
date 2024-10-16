import { PrismaClient, type Stream, type Streamer } from '@prisma/client';
import * as dotenv from 'dotenv';
import { Category, KEYWORDS_PER_CATEGORY, type CategoryStats } from './stream';

dotenv.config();

const CLIP_DURATION = 20;
const CLIP_OFFSET = 10;



function escapeRegExp(str: string) {
	return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const CATEGORY_TO_REGEX = Object.entries(KEYWORDS_PER_CATEGORY).reduce(
	(obj, [category, keywords]) => {
		obj[category as unknown as Category] = new RegExp(
			`(^|\\W)(${keywords.map((keyword) => escapeRegExp(keyword)).join('|')})(\\W|$)`
		);
		return obj;
	},
	{} as Record<Category, RegExp>
);

console.log('DB URL: ', process.env.DATABASE_URL?.slice(0, 5));
export const CLIENT_INSTANCE = new PrismaClient({
	log: [
		{
			emit: 'event',
			level: 'query'
		}
	]
});

CLIENT_INSTANCE.$on('query', (e) => {
	if (e.duration < 2000) {
		return;
	}
	console.log('Long query');
	console.log('Query: ' + e.query);
	console.log('Params: ' + e.params);
	console.log('Duration: ' + e.duration + 'ms');
});

export class PrismaDataProvider {
	async getStreamers(filter?: string) {
		return await CLIENT_INSTANCE.streamer.findMany({
			where: {
				name: {
					contains: filter
				}
			}
		});
	}

	async getDataForStreamer(streamer: Streamer) {
		const data = await CLIENT_INSTANCE.stream.findMany({
			where: {
				streamerId: streamer.id,
				live: true
			},
			include: {
				segments: true
			},
			orderBy: {
				start: 'desc'
			}
		});
		return data;
	}

	async getStreamStats(stream: Stream) {
		const time = new Date().getTime();
		// Select text, messagesSinceStart, and segemnt.game for messages in the current stream
		const a = new Date().getTime();
		const messages = await CLIENT_INSTANCE.message.findMany({
			select: {
				text: true,
				secondsSinceStart: true,
				segment: {
					select: {
						game: true
					}
				}
			},
			where: {
				segment: {
					stream: {
						id: stream.id,
						live: true
					}
				}
			},
		});
		console.log(`Query time: ${new Date().getTime() - a}ms`);

		const categoryStats = new Map<Category, CategoryStats>();
		const categoryStatsPromises = Object.entries(CATEGORY_TO_REGEX).map(async ([cat, regex]) => {
			const category = cat as unknown as Category;
			let maxPeriod = 0;

			const counts: Record<number, number> = messages.reduce(
				(counts, message) => {
					if (category == Category.ALL || regex.test(message.text)) {
						const period = Math.trunc(message.secondsSinceStart / CLIP_DURATION);
						maxPeriod = Math.max(maxPeriod, period);
						counts[period] = (counts[period] || 0) + 1;
					}
					return counts;
				},
				{} as Record<number, number>
			);

			const topClips = Object.entries(counts)
				.filter(([_, count]) => count >= CLIP_DURATION)
				.sort(([_, count1], [__, count2]) => count2 - count1)
				.slice(0, 20)
				.map(([per, count]) => ({
					secondsSinceStart: (per as unknown as number) * CLIP_DURATION - CLIP_OFFSET,
					numMessages: count
				}));
			const messagesPerPeriod = new Array(maxPeriod + 1).fill(0);
			Object.entries(counts).forEach(([period, count]) => {
				messagesPerPeriod[period as unknown as number] = count;
			});
			categoryStats.set(category, {
				topClips,
				messagesPerPeriod
			});
		});
		await Promise.all(categoryStatsPromises);

		const messagesPerGame = Array.from(
			messages.reduce((map, message) => {
				const game = message.segment.game;
				if (game) {
					map.set(game, (map.get(game) || 0) + 1);
				}
				return map;
			}, new Map<string, number>())
		).sort(([_, count1], [__, count2]) => count2 - count1);

		const segments = await CLIENT_INSTANCE.segment.findMany({
			where: {
				streamId: stream.id
			}
		});

		console.log(`Time taken: ${new Date().getTime() - time}ms`);

		return {
			categoryStats: categoryStats,
			messagesPerGame,
			segments
		};
	}
}

export const INSTANCE = new PrismaDataProvider();
