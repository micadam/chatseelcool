<script lang="ts">
	import { Category } from '$lib/stream';
	import ClipButton from '$lib/ClipButton.svelte';
	import type { StreamStatsObj } from '$lib/stream';

	export let streamStatsPromise: Promise<StreamStatsObj>;
	export let vodId: string;
	export let start: Date;
	let currentCategory: string | Category = 0;

	const setCurrentCategory = (n: string | Category) => {
		currentCategory = n;
	};

	const getCategory = (n: string | Category) => {
		if (typeof n === 'string') {
			return n;
		}
		return Category[n];
	};

	const getUrlForSegment = (segment: any) => {
		const segStart = new Date(segment.start)
		const dateDiffSeconds = Math.floor((segStart.getTime() - start.getTime()) / 1000);
		return `https://twitch.tv/videos/${vodId}?t=${dateDiffSeconds}s`;
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
		{#if streamStats.categoryStats[currentCategory].topClips.length === 0}
			<p>No clips found for this category</p>
		{:else}
			<p>
				Here are the top clips from this stream from the {getCategory(currentCategory)} category
			</p>
			<div id="topClips">
				{#each streamStats.categoryStats[currentCategory].topClips as clip}
					<ClipButton {clip} {vodId} />
				{/each}
			</div>
		{/if}
		Here is the number of messages per game:
		{#each Object.entries(streamStats.messagesPerGame) as [game, count]}
			<p>{game}: {count}</p>
		{/each}

		Here are some buttons for the start of each segment:
		<ul>
			{#each streamStats.segments as segment}
				<li><a
					href={getUrlForSegment(segment)} target="_blank">{segment.game}</a
				></li>
			{/each}
		</ul>
	{:catch error}
		<p>{error.message}</p>
	{/await}
</div>
