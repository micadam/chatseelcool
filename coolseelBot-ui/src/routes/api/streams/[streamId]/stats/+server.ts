import { INSTANCE as dataProvider, CLIENT_INSTANCE as client } from '$lib/dataProvider';
import { PrismaClient } from '@prisma/client';

export async function GET(request) {
	const { streamId } = request.params;
	const stream = await client.stream.findUnique({
		where: {
			id: parseInt(streamId)
		}
	});
	if (!stream) {
		return new Response('', { status: 404 });
	}
	const streamStats = await dataProvider.getStreamStats(stream);
	const data = JSON.stringify({
		categoryStats: Object.fromEntries(streamStats.categoryStats),
		messagesPerGame: streamStats.messagesPerGame,
		segments: streamStats.segments
	});
	return new Response(data);
}
