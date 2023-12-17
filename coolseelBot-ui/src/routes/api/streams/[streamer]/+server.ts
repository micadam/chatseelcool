import { INSTANCE as dataProvider } from '$lib/dataProvider';

export function GET(request) {
	const { streamer } = request.params;
	const data = JSON.stringify(dataProvider.getDataForStreamer(streamer));
	return new Response(data);
}
