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
	const data = JSON.stringify({
		categoryStats: Object.fromEntries(
			await dataProvider.getStreamStats(stream).then((stats) => stats.categoryStats)
		)
	});
	return new Response(data);
}
