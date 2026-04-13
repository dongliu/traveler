mongoshell="use admin"
mongoshell="$mongoshell \n db.createUser( { user: \"traveler\", pwd: \"travelerpassword\", roles: [ { role: \"readWrite\", db: \"traveler\" } ] } )"
echo -e $mongoshell | mongo -u root -p rootspass --authenticationDatabase admin
