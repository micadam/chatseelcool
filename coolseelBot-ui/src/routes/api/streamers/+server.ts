import { INSTANCE as dataProvider } from '$lib/dataProvider';

export async function GET() {
	const data = JSON.stringify(await dataProvider.getStreamers('northernlion'));
	return new Response(data);
}
