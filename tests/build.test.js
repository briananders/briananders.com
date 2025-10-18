const { execSync } = require('child_process');

describe('NPM Build Task', () => {
  it('should run npm build successfully', () => {
    // Expect the command to run without errors
    expect(() => execSync('npm run build')).not.toThrow();
  });
});