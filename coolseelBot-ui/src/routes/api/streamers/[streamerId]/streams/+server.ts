import { INSTANCE as dataProvider, CLIENT_INSTANCE as client } from '$lib/dataProvider';
import { PrismaClient, type Streamer } from '@prisma/client';

export async function GET(request) {
	const { streamerId } = request.params;
	const streamer = await client.streamer.findUnique({
		where: {
			id: parseInt(streamerId)
		}
	});
	if (!streamer) {
		return new Response('', { status: 404 });
	}
	const data = await dataProvider.getDataForStreamer(streamer);
	return new Response(JSON.stringify(data));
}
