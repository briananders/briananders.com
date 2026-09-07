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
      <api-image src="{{imageSrc}}" alt="{{name}}" width="100" height="100"></api-image>
    {{/if}}
  </a>
{{/each}}
`;
