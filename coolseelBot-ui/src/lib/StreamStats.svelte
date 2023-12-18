<script lang="ts">
	import { Category } from '$lib/stream';
	import type { StreamStatsObj } from '$lib/stream';

	export let streamStatsPromise: Promise<StreamStatsObj>;
	export let vodId: string;
	let currentCategory: string | Category = 0;

	const getTimeStr = (seconds: number) => {
		let str = '';
		if (seconds >= 3600) {
			str += `${Math.floor(seconds / 3600)}h`;
			seconds %= 3600;
		}
		if (seconds >= 60) {
			str += `${Math.floor(seconds / 60)}m`;
			seconds %= 60;
		}
		str += `${seconds}s`;
		return str;
	};

	const setCurrentCategory = (n: string | Category) => {
		currentCategory = n;
	};

	const getCategory = (n: string | Category) => {
		if (typeof n === 'string') {
			return n;
		}
		return Category[n];
	};
</script>

<div id="stream-stats">
	{#await streamStatsPromise}
		<p>loading...</p>
	{:then streamStats}
		<div class="category-selector">
			{#each Object.values(Category).filter((n) => typeof n === 'number') as n}
				<input
					type="radio"
					checked={currentCategory === n}
					on:click={() => setCurrentCategory(n)}
					on:keypress={() => setCurrentCategory(n)}
					id={n.toString()}
				/>
				<label class:active={currentCategory == n} for={n.toString()}>{getCategory(n)}</label>
			{/each}
		</div>
		<p>
			Here are the top clips from this stream from the {getCategory(currentCategory)} category
		</p>
		<ol>
			{#each streamStats.categoryStats[currentCategory].topClips as clip}
				<li>
					<a href="http://twitch.tv/videos/{vodId}?t={clip.secondsSinceStart}s">
						Time: {getTimeStr(clip.secondsSinceStart)}, hits: {clip.numMessages}
					</a>
				</li>
			{/each}
		</ol>
	{:catch error}
		<p>{error.message}</p>
	{/await}
</div>
