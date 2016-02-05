#!/bin/bash

MY_DIR=`dirname $0`

source $MY_DIR/configure_paths.sh

# import local traveler-mongo settings and perform error checking
mongoConfigurationFile=$TRAVELER_INSTALL_ETC_DIR/mongo-configuration.sh
if [ -f $mongoConfigurationFile ]; then
  source $mongoConfigurationFile
else
  >&2 echo "ERROR $mongoConfigurationFile does not exist."
  exit 1
fi
if [ ! -f $MONGO_ADMIN_PASSWD_FILE ]; then
  >&2 echo "ERROR $MONGO_ADMIN_PASSWD_FILE does not exist."
  exit 1
fi
if [ -z $MONGO_ADMIN_USERNAME ]; then
  >&2 echo "ERROR: missing administration username in configuration - $mongoConfigurationFile."
  exit 1
fi
if [ -z $MONGO_SERVER_PORT ]; then
  >&2 echo "ERROR: missing server port in configuration - $mongoConfigurationFile."
  exit 1
fi
if [ -z $MONGO_SERVER_ADDRESS ]; then
  >&2 echo "ERROR: missing server address in configuration - $mongoConfigurationFile."
  exit 1
fi
if [ -z $MONGO_TRAVELER_DB ]; then
  >&2 echo "ERROR: missing traveler database in configuration - $MONGO_TRAVELER_DB."
  exit 1
fi


# perform restore
if [ ! -d $TRAVELER_BACKUP_DIRECTORY ]; then
  >&2 echo "ERROR: no backup directory $TRAVELER_BACKUP_DIRECTORY, nothing to restore"
  exit 1
fi

cd $TRAVELER_BACKUP_DIRECTORY

if [ -z `ls` ]; then
  >&2 echo "ERROR: no backups exist in $TRAVELER_BACKUP_DIRECTORY"
fi

promptUserForBackupDirectory(){
  latestBackup=`ls -t | head -1`
  echo "Enter 'ls' to view a list of backups."
  read -p "Please enter the backup you wish to restore [$latestBackup]: " chosenBackupDate

  if [ -z $chosenBackupDate ]; then
    chosenBackupDate=$latestBackup
  else
    if [ "$chosenBackupDate" == "ls" ]; then
      echo '========================================================'
      ls -l
      echo '========================================================'
      promptUserForBackupDirectory
    elif [ ! -d $chosenBackupDate ]; then
      echo "Backup not found (Follow date format: YYYYMMDD)"
      promptUserForBackupDirectory
    fi
  fi
}

promptUserForBackupDirectory

cd $chosenBackupDate

adminPassword=`cat $MONGO_ADMIN_PASSWD_FILE`

PS3="Select time of backup: "
select backupTime in *;
do
  case $backupTime in
    *)
      if [ -z $backupTime ]; then
        >&2 echo "Invalid option entered"
      else
        cd $backupTime
        echo "Restoring backup: $chosenBackupDate - $backupTime"
        # Drop current traveler database
        dropCommand="use $MONGO_TRAVELER_DB; \n db.dropDatabase();"
        echo -e $dropCommand | $MONGO_BIN_DIRECTORY/mongo $MONGO_SERVER_ADDRESS:$MONGO_SERVER_PORT/admin --username $MONGO_ADMIN_USERNAME --password $adminPassword

        $MONGO_BIN_DIRECTORY/mongorestore \
        --host $MONGO_SERVER_ADDRESS \
        --port $MONGO_SERVER_PORT \
        --username $MONGO_ADMIN_USERNAME \
        --password $adminPassword
        break;
      fi
      ;;
  esac
done
