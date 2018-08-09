#!/bin/zsh
echo "Changing build permissions to 755"
chmod -R 755 package/
echo "Emptying s3 bucket"
aws s3 rm s3://staging.briananders.net --recursive
echo "Moving Files to S3 staging"
aws s3 sync package/ s3://staging.briananders.net
echo "Setting Cache-Control headers"
aws s3 cp s3://staging.briananders.net/ s3://staging.briananders.net/ --exclude "*" --include "*.css" --include "*.js" --include "*.svg" --include "*.jpg" --include "*.png" --recursive --metadata-directive REPLACE --expires 2034-01-01T00:00:00Z --acl public-read --cache-control max-age=2592000,public
echo "Done"

# /bin/zsh deploy_staging.sh
