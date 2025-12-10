# GitHub Workflows

## Claude Code Review

The `claude-pr-review.yml` workflow automatically reviews pull requests using Claude AI.

### Setup Requirements

1. **Anthropic API Key**: Add your Anthropic API key as a repository secret named `ANTHROPIC_API_KEY`
   - Go to repository Settings → Secrets and variables → Actions
   - Click "New repository secret"
   - Name: `ANTHROPIC_API_KEY`
   - Value: Your Anthropic API key from https://console.anthropic.com/

2. **API Credits**: Ensure your Anthropic account has sufficient credits
   - Check your balance at https://console.anthropic.com/settings/billing
   - The workflow will fail with "Credit balance is too low" if insufficient

### Configuration

The workflow can be customized by editing `.github/workflows/claude-pr-review.yml`:

- **Model Selection**: Change the `model` parameter to use different Claude models:
  - `claude-sonnet-4-20250514` - Fast, balanced (default)
  - `claude-opus-4-20250514` - Most capable, slower and more expensive
  
- **Review Prompt**: Modify the `direct_prompt` section to customize what Claude reviews

### Troubleshooting

**Error: "Credit balance is too low"**
- Solution: Add credits to your Anthropic account at https://console.anthropic.com/settings/billing

**Error: Invalid model name**
- Solution: Use a valid model identifier (see Configuration section above)
- Check current model names at https://docs.anthropic.com/en/docs/about-claude/models

**Workflow not triggering**
- The workflow only runs on PR `opened` and `synchronize` events
- Check that the repository has the `ANTHROPIC_API_KEY` secret configured

**Permission errors**
- Ensure the workflow has the correct permissions (already configured in the file)
- Check repository Settings → Actions → General → Workflow permissions
