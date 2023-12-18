import { INSTANCE as dataProvider } from '$lib/dataProvider';
import { PrismaClient } from '@prisma/client';

const client = new PrismaClient();

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
