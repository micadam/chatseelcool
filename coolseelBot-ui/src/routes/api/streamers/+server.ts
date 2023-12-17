import { INSTANCE as dataProvider } from '$lib/dataProvider';

export function GET(request): Response {
	const data = JSON.stringify(dataProvider.getStreamers());
	return new Response(data);
}
