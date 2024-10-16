export enum Category {
	ALL,
	POG,
	LAUGH,
	SCARY,
	SHOCK,
	HUH,
	MUSIC,
	CINEMA,
	GOOD_BIT,
	BAD_BIT
}

export const KEYWORDS_PER_CATEGORY = {
	[Category.ALL]: [''],
	[Category.POG]: ['Pog', 'POGGERS', 'PogChamp', 'LETSGO', 'POGCRAZY'],
	[Category.LAUGH]: ['LUL', 'ICANT', 'KEKW'],
	[Category.SCARY]: ['monkaS'],
	[Category.SHOCK]: ['Cereal'],
	[Category.HUH]: ['HUHH'],
	[Category.MUSIC]: ['Jupijej', 'VIBE', 'DinoDance', 'ratJAM'],
	[Category.CINEMA]: ['Cinema', 'BINEMA', 'CINEMA'],
	[Category.GOOD_BIT]: ['+2'],
	[Category.BAD_BIT]: ['-2']
};

export interface StreamStats {
	categoryStats: Map<Category, CategoryStats>;
}

export interface StreamStatsObj {
	categoryStats: {
		[category: string]: CategoryStats;
	};
	messagesPerGame: any;
	segments: any;
}

export interface CategoryStats {
	topClips: Clip[];
	messagesPerPeriod: number[];
}

export interface Clip {
	secondsSinceStart: number;
	numMessages: number;
}
