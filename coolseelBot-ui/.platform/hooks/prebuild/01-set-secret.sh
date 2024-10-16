#!/bin/sh
echo "Getting secret"
SECRET_STRING=$(aws secretsmanager get-secret-value --secret-id rds!db-34e1ed7c-5039-499a-b030-2d01704fb821 --region ca-central-1 --query SecretString --output text)
export USERNAME=$(echo $SECRET_STRING | jq -r .username)
export PASSWORD=$(echo $SECRET_STRING | jq -r .password)
DATABASE_URL="postgresql://$USERNAME:$PASSWORD@chatalytics-db.cduo6626auty.ca-central-1.rds.amazonaws.com:5432/coolseel"
echo "DATABASE_URL=$DATABASE_URL" >> /var/app/current/.env
echo "DATABASE_URL=$DATABASE_URL" >> /var/app/.env
echo "DATABASE_URL=$DATABASE_URL" >> /var/app/current/server/.env
echo "DATABASE_URL=$DATABASE_URL" >> /.env
echo "DATABASE_URL=$DATABASE_URL" >> .env
echo "Updated DATABASE_URL for user $USERNAME"
