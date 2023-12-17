interface Streamer {
	name: string;
	streams: Stream[];
}

export interface StreamerWithMessages extends Streamer {
	streams: StreamWithMessages[];
}

export interface Stream {
	id: string;
	start: Date;
	segments: StreamSegment[];
	live: boolean;
}

interface StreamSegment {
	start: Date;
	game: string;
}

interface StreamWithMessages extends Stream {
	segments: StreamSegmentWithMessages[];
}

interface StreamSegmentWithMessages extends StreamSegment {
	messages: Message[];
}

interface Message {
	username: string;
	text: string;
	secondsSinceStart: number;
}

export enum Category {
	ALL,
	POG,
	LAUGH,
	SCARY,
	HORNY,
	GOOD_BIT,
	BAD_BIT
}

export interface StreamStats {
	categoryStats: Map<Category, CategoryStats>;
}

export interface StreamStatsObj {
	categoryStats: {
		[category: string]: CategoryStats;
	};
}

export interface CategoryStats {
	topClips: Clip[];
	messagesPerPeriod: number[];
}

interface Clip {
	secondsSinceStart: number;
	numMessages: number;
}
