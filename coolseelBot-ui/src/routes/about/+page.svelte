<script lang="ts">
	import { KEYWORDS_PER_CATEGORY, Category } from '$lib/stream';
</script>

<article>
	<h2>About</h2>
	<p>
		This web app uses data from NL's chat to automatically generate twitch highlights. Roughly
		speaking, each category tracks the 20-second window in the stream with the highest number of
		matching messages (e.g. "LUL" for the "funny" category). The data is pulled in real time, so you
		can even track engagament during the stream!
	</p>

	<p>
		For any feedback, suggestions, or anything else, please feel free to contact me on Discord
		@coolseel.
	</p>

	<h2>TO-DO</h2>
	<p>
		This is a rough list of things I still plan to do with the app, in no particular order.
		Suggestions also welcome.
	</p>
	<ul>
		<li>Make data loading faster.</li>
		<li>Improve the mobile browsing experience.</li>
		<li>
			Automatically clean up data from streams older than the VOD deletion period.
		</li>
		<li>Display metrics beyond per stream (e.g. per segment, per week, per month)</li>
		<li>Maybe think about open-sourcing the project a bit.</li>
	</ul>

	<h2 id="categories">Categories</h2>
	Here are the categories I use for the app, and what keywords trigger them. Note that the keywords are
	case-sensitive.

	<ul>
		{#each Object.entries(KEYWORDS_PER_CATEGORY) as [category, keywords]}
			<li>
				<b>{Category[+category]}</b>:
				{#if +category !== Category.ALL}
					{#each keywords as keyword, i}
						<code>{keyword}</code>{i < keywords.length - 1 ? ', ' : ''}
			  		{/each}
				{:else}
					(all messages)
				{/if}
			</li>
		{/each}
	</ul>
</article>
