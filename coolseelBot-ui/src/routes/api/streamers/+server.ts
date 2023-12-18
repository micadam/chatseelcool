import { INSTANCE as dataProvider } from '$lib/dataProvider';

export async function GET() {
	const data = JSON.stringify(await dataProvider.getStreamers());
	return new Response(data);
}
