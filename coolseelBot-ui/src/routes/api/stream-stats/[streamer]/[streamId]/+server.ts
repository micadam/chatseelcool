import { INSTANCE as dataProvider } from '$lib/dataProvider';

export function GET(request): Response {
	const { streamer, streamId } = request.params;
	const data = JSON.stringify({
		categoryStats: Object.fromEntries(dataProvider.getStreamStats(streamer, streamId).categoryStats)
	});
	return new Response(data);
}
