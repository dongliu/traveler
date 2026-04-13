#!/bin/bash

DB=traveler
# the directory to hold back up files, change it for your env
BACKUP_DIR=/backup
DATE=`date +%Y%m%d_%H%M%S`

if [ ! -d "$BACKUP_DIR" ]; then
  mkdir -p $BACKUP_DIR
fi

mongodump -u traveler -p travelerpassword --authenticationDatabase admin --db $DB --out /tmp/${DB}db_$DATE
tar czf $BACKUP_DIR/${DB}db_$DATE.tgz -C /tmp ${DB}db_$DATE
rm -rf /tmp/${DB}db_$DATE

find $BACKUP_DIR -mtime +7 -exec rm {} \;
