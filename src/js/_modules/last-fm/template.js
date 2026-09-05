module.exports = `
{{#each items}}
  <a itemprop="url"
      target="_blank"
      rel="noopener"
      href="{{url}}"
      class="item {{#if artist}}album{{else}}artist{{/if}}"
      title="{{name}}, {{playcount}} plays">
    <span class="info">
      <span class="name">
        {{name}}
      </span>
      {{#if artist}}
        <span class="name">
          {{artist.name}}
        </span>
      {{/if}}
      <span class="scrobbles">
        {{playcount}} plays
      </span>
      <bar style="width: {{percent}}%;"></bar>
    </span>
    {{#if imageSrc}}
      <link rel="preload" href="{{imageAvif}}" as="image" type="image/avif" />
      <picture>
        <source data-srcset="{{imageAvif}}" type="image/avif" />
        <source data-srcset="{{imageWebp}}" type="image/webp" />
        <img lazy src="data:image/svg+xml,%3Csvg xmlns='https://www.w3.org/2000/svg' viewBox='0 0 1 1'%3E%3C/svg%3E" data-src="{{imageSrc}}" alt="{{name}}" width="100" height="100" />
      </picture>
    {{/if}}
  </a>
{{/each}}
`;
