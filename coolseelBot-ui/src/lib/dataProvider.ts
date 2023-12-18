import { PrismaClient, type Stream, type Streamer } from '@prisma/client';
import { Category, type CategoryStats } from './stream';

const CLIP_DURATION = 20;
const CLIP_OFFSET = 10;

const KEYWORDS_PER_CATEGORY = {
	[Category.ALL]: [''],
	[Category.POG]: ['Pog', 'POGGERS', 'PogChamp', 'LETSGO', 'POGCRAZY'],
	[Category.LAUGH]: ['LUL', 'ICANT', 'KEKW'],
	[Category.SCARY]: ['monkaS'],
	[Category.SHOCK]: ['Cereal'],
	// [Category.HORNY]: ['COCKA'],
	[Category.MUSIC]: ['Jupijej', 'VIBE', 'DinoDance', 'ratJAM'],
	[Category.GOOD_BIT]: ['+2'],
	[Category.BAD_BIT]: ['-2']
};

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

export const CLIENT_INSTANCE = new PrismaClient();

export class PrismaDataProvider {
	async getStreamers() {
		return await CLIENT_INSTANCE.streamer.findMany();
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
		const messages = await CLIENT_INSTANCE.message.findMany({
			select: {
				text: true,
				secondsSinceStart: true
			},
			where: {
				segment: {
					stream: {
						id: stream.id,
						live: true
					}
				}
			}
		});

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

		return {
			categoryStats: categoryStats
		};
	}
}

export const INSTANCE = new PrismaDataProvider();
